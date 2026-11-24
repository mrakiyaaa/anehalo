import type { DiagramSummary, Note, NoteSummary } from '@/types/notes';
import type { NoteRepository } from '@/features/storage/NoteRepository';
import { success, failure, type RepositoryResult } from '@/features/storage/repository-result';
import { isInsideFolder } from '@/features/storage/storage-paths';
import type { VaultItem } from '@/features/storage/vault-items';
import { logFailure } from '@/features/diagnostics/error-logging';
import type { DiagramContentListener, StoredElement } from '@/features/diagrams/DiagramContentScan';
import type { SearchEngine, SearchFilter, SearchResult } from './SearchEngine';
import { matchingRanges, normalizedText } from './search-text';
import { SearchTextProcessor } from './SearchTextProcessor';
import type { AnalyzedSearchText, DiagramSource } from './search-processing';
import { elementAt, type DiagramTextSegment } from './diagram-search-text';
import type { RepositoryError } from '@/features/storage/repository-result';

const yieldToInput = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
interface IndexedItem {
  item: VaultItem;
  text: string;
  title: string;
  body: string;
  /** Diagrams only: which element each part of the text came from. */
  segments?: readonly DiagramTextSegment[];
}
type PendingWork =
  | { readonly kind: 'note'; readonly note: Note }
  | { readonly kind: 'diagram'; readonly diagram: DiagramSummary; readonly source: DiagramSource };

function searchTerms(query: string) {
  return normalizedText(query).value.trim().split(/\s+/u).filter(Boolean);
}

function noteItem(note: Note | NoteSummary, text: string): VaultItem {
  return {
    kind: 'note',
    title: note.title,
    folder: note.folder,
    relativePath: note.relativePath,
    modifiedAt: note.modifiedAt,
    snippet: text.slice(0, 120),
    searchText: text,
  };
}

function pendingPath(work: PendingWork) {
  return work.kind === 'note' ? work.note.relativePath : work.diagram.relativePath;
}

/** Notes and diagrams, searched by title and text. Diagrams arrive from the diagram scan. */
export class SearchIndex implements SearchEngine, DiagramContentListener {
  private readonly processor = new SearchTextProcessor();
  private processingGeneration = 0;
  private items = new Map<string, IndexedItem>();
  private generation = 0;
  isRefreshing = false;
  private mutations = new Map<string, number>();
  private revision = 0;
  private pending = new Map<string, PendingWork>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  constructor(
    private readonly changed: () => void = () => {},
    private readonly report: (error: RepositoryError) => void = () => {},
  ) {}

  update(note: Note) {
    this.queue({ kind: 'note', note });
  }
  diagramRead(diagram: DiagramSummary, text: string) {
    this.queue({ kind: 'diagram', diagram, source: { json: text } });
  }
  diagramSaved(diagram: DiagramSummary, elements: readonly StoredElement[]) {
    this.queue({ kind: 'diagram', diagram, source: { elements } });
  }
  diagramRemoved(path: string) {
    this.remove(path);
  }
  private queue(work: PendingWork) {
    const path = pendingPath(work);
    this.mutations.set(path, ++this.revision);
    this.pending.set(path, work);
    this.timer ??= setTimeout(() => {
      this.timer = undefined;
      void this.drain();
    }, 0);
  }
  private index(note: Note, analyzed: AnalyzedSearchText) {
    const { text } = analyzed;
    this.items.set(note.relativePath, {
      item: noteItem(note, text),
      text,
      title: analyzed.title,
      body: analyzed.body,
    });
  }
  /**
   * Whether newer work replaced what was being analysed. A refresh may clear the path's entry
   * meanwhile; that is not newer work, so the analysis is kept.
   */
  private supersededSince(path: string, revision: number | undefined) {
    const current = this.mutations.get(path);
    return current !== undefined && current !== revision;
  }
  private async drain() {
    const generation = this.processingGeneration;
    let lastYield = performance.now();
    for (const [path, work] of this.pending) {
      this.pending.delete(path);
      const revision = this.mutations.get(path);
      if (work.kind === 'note') {
        const analyzed = await this.processor.analyze(work.note.title, work.note.content);
        if (generation !== this.processingGeneration) return;
        if (this.supersededSince(path, revision)) continue;
        if (analyzed.kind === 'analyze' && analyzed.result.ok) {
          this.index(work.note, analyzed.result.value);
          this.changed();
        } else if (!analyzed.result.ok) this.report(analyzed.result.error);
      } else {
        const analyzed = await this.processor.analyzeDiagram(work.diagram.title, work.source);
        if (generation !== this.processingGeneration) return;
        if (this.supersededSince(path, revision)) continue;
        if (analyzed.kind === 'diagram' && analyzed.result.ok) {
          const { text, title, body, segments } = analyzed.result.value;
          this.items.set(path, { item: work.diagram, text, title, body, segments });
          this.changed();
        } else if (!analyzed.result.ok) {
          // The scan reads each version once, so a corrupt file is logged once and skipped.
          this.items.delete(path);
          logFailure('diagram-search-skipped', analyzed.result.error.code);
          this.changed();
        }
      }
      // Analysis runs in the worker; yielding in slices keeps input responsive without
      // spreading hundreds of diagrams over hundreds of timer ticks.
      if (performance.now() - lastYield >= 8) {
        await yieldToInput();
        lastYield = performance.now();
      }
    }
  }
  remove(path: string) {
    this.mutations.set(path, ++this.revision);
    for (const key of this.items.keys()) if (isInsideFolder(key, path)) this.items.delete(key);
    for (const key of this.pending.keys()) if (isInsideFolder(key, path)) this.pending.delete(key);
    this.changed();
  }
  /** A diagram renamed or moved in Anehalo: its text is unchanged, only its title and path. */
  relocateDiagram(previousPath: string, diagram: DiagramSummary) {
    const entry = this.items.get(previousPath);
    const pending = this.pending.get(previousPath);
    this.remove(previousPath);
    this.mutations.set(diagram.relativePath, ++this.revision);
    if (entry)
      this.items.set(diagram.relativePath, {
        ...entry,
        item: diagram,
        title: normalizedText(diagram.title).value,
      });
    if (pending?.kind === 'diagram') this.queue({ ...pending, diagram });
    this.changed();
  }
  relocateFolder(previousPath: string, nextPath: string) {
    const entries = [...this.items.values()].filter((entry) =>
      isInsideFolder(entry.item.relativePath, previousPath),
    );
    const pending = [...this.pending.values()].filter((work) =>
      isInsideFolder(pendingPath(work), previousPath),
    );
    const relocate = (path: string) => `${nextPath}${path.slice(previousPath.length)}`;
    const relocateItem = <Value extends NoteSummary | DiagramSummary>(item: Value): Value => ({
      ...item,
      relativePath: relocate(item.relativePath),
      folder:
        item.folder && isInsideFolder(item.folder, previousPath)
          ? relocate(item.folder)
          : item.folder,
    });
    this.remove(previousPath);
    for (const entry of entries) {
      const item = relocateItem(entry.item);
      this.mutations.set(item.relativePath, ++this.revision);
      this.items.set(item.relativePath, { ...entry, item });
    }
    for (const work of pending)
      this.queue(
        work.kind === 'note'
          ? { kind: 'note', note: relocateItem(work.note) }
          : { ...work, diagram: relocateItem(work.diagram) },
      );
    this.changed();
  }
  async refresh(
    repository: NoteRepository,
    summaries: readonly NoteSummary[],
  ): Promise<RepositoryResult<void>> {
    const generation = ++this.generation;
    this.isRefreshing = true;
    this.changed();
    const revision = this.revision;
    const paths = new Set(summaries.map((note) => note.relativePath));
    const errors: string[] = [];
    let scanned = 0;
    for (const summary of summaries) {
      if (++scanned % 20 === 0) await yieldToInput();
      if (generation !== this.generation) return success(undefined);
      const read = await (repository.readSnapshotNote?.(summary.relativePath, summary) ??
        repository.readNote(summary.relativePath));
      if (generation !== this.generation) return success(undefined);
      const mutated = [...this.mutations].some(
        ([path, changed]) => changed > revision && isInsideFolder(summary.relativePath, path),
      );
      if (mutated) continue;
      if (read.ok) {
        const analyzed = await this.processor.analyze(read.value.title, read.value.content);
        if (generation !== this.generation) return success(undefined);
        if (
          [...this.mutations].some(
            ([path, changed]) => changed > revision && isInsideFolder(summary.relativePath, path),
          )
        )
          continue;
        if (analyzed.kind === 'analyze' && analyzed.result.ok)
          this.index(read.value, analyzed.result.value);
        else if (!analyzed.result.ok) errors.push(analyzed.result.error.message);
      } else errors.push(read.error.message);
    }
    // Only notes are listed here; diagrams are kept in step by the diagram scan.
    for (const [path, entry] of this.items)
      if (
        entry.item.kind === 'note' &&
        !paths.has(path) &&
        (this.mutations.get(path) ?? 0) <= revision
      )
        this.items.delete(path);
    for (const [path, changed] of this.mutations)
      if (changed <= revision) this.mutations.delete(path);
    this.isRefreshing = false;
    this.changed();
    return errors.length
      ? failure({
          code: 'io-error',
          message: `Could not search ${errors.length} note(s).`,
          detail: errors.join('\n'),
        })
      : success(undefined);
  }
  cancel() {
    this.generation++;
    this.processingGeneration++;
    this.processor.cancel();
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    this.pending.clear();
    this.isRefreshing = false;
  }
  async search(query: string, filter: SearchFilter = 'all'): Promise<readonly SearchResult[]> {
    const terms = searchTerms(query);
    const matches: { entry: IndexedItem; rank: number }[] = [];
    let lastYield = performance.now();
    for (const entry of this.items.values()) {
      if (
        filter === 'notes'
          ? entry.item.kind !== 'note'
          : filter === 'diagrams' && entry.item.kind !== 'diagram'
      )
        continue;
      if (terms.every((term) => entry.title.includes(term) || entry.body.includes(term)))
        matches.push({
          entry,
          rank: terms.reduce((rank, term) => rank + (entry.title.includes(term) ? 10 : 1), 0),
        });
      if (performance.now() - lastYield >= 8) {
        await yieldToInput();
        lastYield = performance.now();
      }
    }
    const ranked = matches
      .sort(
        (left, right) =>
          right.rank - left.rank ||
          right.entry.item.modifiedAt - left.entry.item.modifiedAt ||
          left.entry.item.relativePath.localeCompare(right.entry.item.relativePath),
      )
      .slice(0, terms.length ? 80 : 8);
    return Promise.all(
      ranked.map(async ({ entry }) => {
        const prepared = await this.processor.snippet(entry.text, query);
        if (prepared.kind === 'snippet' && prepared.result.ok)
          return { item: entry.item, snippet: prepared.result.value };
        if (!prepared.result.ok) this.report(prepared.result.error);
        return { item: entry.item, snippet: { text: entry.text.slice(0, 180), ranges: [] } };
      }),
    );
  }
  /**
   * The diagram element to show for a query: the one holding the first search word that is not
   * in the title. Null for a title match, a note, or an unknown path.
   */
  matchedElement(path: string, query: string): string | null {
    const entry = this.items.get(path);
    if (!entry?.segments) return null;
    const contentTerm = searchTerms(query).find((term) => !entry.title.includes(term));
    if (!contentTerm) return null;
    const range = matchingRanges(entry.text, contentTerm)[0];
    return range ? elementAt(entry.segments, range.start) : null;
  }
}
