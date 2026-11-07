import type { Note, NoteSummary } from '@/types/notes';
import type { NoteRepository } from '@/features/storage/NoteRepository';
import { success, failure, type RepositoryResult } from '@/features/storage/repository-result';
import { isInsideFolder } from '@/features/storage/storage-paths';
import type { SearchEngine, SearchResult } from './SearchEngine';
import { normalizedText } from './search-text';
import { SearchTextProcessor } from './SearchTextProcessor';
import type { AnalyzedSearchText } from './search-processing';
import type { RepositoryError } from '@/features/storage/repository-result';

const yieldToInput = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
interface IndexedNote {
  note: NoteSummary;
  text: string;
  title: string;
  body: string;
}

export class SearchIndex implements SearchEngine {
  private readonly processor = new SearchTextProcessor();
  private processingGeneration = 0;
  private notes = new Map<string, IndexedNote>();
  private generation = 0;
  isRefreshing = false;
  private mutations = new Map<string, number>();
  private revision = 0;
  private pending = new Map<string, Note>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  constructor(
    private readonly changed: () => void = () => {},
    private readonly report: (error: RepositoryError) => void = () => {},
  ) {}

  update(note: Note) {
    this.mutations.set(note.relativePath, ++this.revision);
    this.pending.set(note.relativePath, note);
    this.timer ??= setTimeout(() => {
      this.timer = undefined;
      void this.drain();
    }, 0);
  }
  private index(note: Note, analyzed: AnalyzedSearchText) {
    const { text } = analyzed;
    this.notes.set(note.relativePath, {
      note: {
        title: note.title,
        folder: note.folder,
        relativePath: note.relativePath,
        modifiedAt: note.modifiedAt,
        snippet: text.slice(0, 120),
        searchText: text,
      },
      text,
      title: analyzed.title,
      body: analyzed.body,
    });
  }
  private async drain() {
    const generation = this.processingGeneration;
    for (const [path, note] of this.pending) {
      this.pending.delete(path);
      const revision = this.mutations.get(path);
      const analyzed = await this.processor.analyze(note.title, note.content);
      if (generation !== this.processingGeneration) return;
      if (this.mutations.get(path) !== revision) continue;
      if (analyzed.kind === 'analyze' && analyzed.result.ok) {
        this.index(note, analyzed.result.value);
        this.changed();
      } else if (!analyzed.result.ok) this.report(analyzed.result.error);
      await yieldToInput();
    }
  }
  remove(path: string) {
    this.mutations.set(path, ++this.revision);
    for (const key of this.notes.keys()) if (isInsideFolder(key, path)) this.notes.delete(key);
    for (const key of this.pending.keys()) if (isInsideFolder(key, path)) this.pending.delete(key);
    this.changed();
  }
  relocateFolder(previousPath: string, nextPath: string) {
    const entries = [...this.notes.values()].filter((entry) =>
      isInsideFolder(entry.note.relativePath, previousPath),
    );
    const pending = [...this.pending.values()].filter((note) =>
      isInsideFolder(note.relativePath, previousPath),
    );
    const relocate = (path: string) => `${nextPath}${path.slice(previousPath.length)}`;
    const relocateNote = <Value extends NoteSummary>(note: Value): Value => ({
      ...note,
      relativePath: relocate(note.relativePath),
      folder:
        note.folder && isInsideFolder(note.folder, previousPath)
          ? relocate(note.folder)
          : note.folder,
    });
    this.remove(previousPath);
    for (const entry of entries) {
      const note = relocateNote(entry.note);
      this.mutations.set(note.relativePath, ++this.revision);
      this.notes.set(note.relativePath, { ...entry, note });
    }
    for (const note of pending) this.update(relocateNote(note));
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
    for (const path of this.notes.keys())
      if (!paths.has(path) && (this.mutations.get(path) ?? 0) <= revision) this.notes.delete(path);
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
  async search(query: string): Promise<readonly SearchResult[]> {
    const terms = normalizedText(query).value.trim().split(/\s+/u).filter(Boolean);
    const matches: { entry: IndexedNote; rank: number }[] = [];
    let lastYield = performance.now();
    for (const entry of this.notes.values()) {
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
          right.entry.note.modifiedAt - left.entry.note.modifiedAt ||
          left.entry.note.relativePath.localeCompare(right.entry.note.relativePath),
      )
      .slice(0, terms.length ? 80 : 8);
    return Promise.all(
      ranked.map(async ({ entry }) => {
        const prepared = await this.processor.snippet(entry.text, query);
        if (prepared.kind === 'snippet' && prepared.result.ok)
          return { note: entry.note, snippet: prepared.result.value };
        if (!prepared.result.ok) this.report(prepared.result.error);
        return { note: entry.note, snippet: { text: entry.text.slice(0, 180), ranges: [] } };
      }),
    );
  }
}
