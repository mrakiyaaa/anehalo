import type { NoteRepository } from '@/features/storage/NoteRepository';
import type { DiagramSummary, Note, NoteSummary } from '@/types/notes';
import { isInsideFolder } from '@/features/storage/storage-paths';
import {
  success,
  failure,
  describeStorageError,
  type RepositoryError,
  type RepositoryResult,
} from '@/features/storage/repository-result';
import { scanNoteLinks } from './NoteLinkRewriter';
import { diagramElementLinks } from '@/features/links/element-links';

/** Reads a diagram's stored text, so its element links can be indexed without Excalidraw. */
export interface DiagramTextSource {
  readDiagramText(path: string): Promise<RepositoryResult<string>>;
}

export interface LinkIndexSnapshot {
  readonly outgoing: ReadonlyMap<string, ReadonlySet<string>>;
  readonly backlinks: ReadonlyMap<string, readonly string[]>;
}
export const emptyLinkIndex: LinkIndexSnapshot = { outgoing: new Map(), backlinks: new Map() };

export class NoteLinkIndex {
  private outgoing = new Map<string, ReadonlySet<string>>();
  private revision = 0;
  private scanIdentifier = 0;
  private readonly mutations = new Map<string, number>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  /**
   * Sources are notes and, given a diagram reader, diagrams (their element links); targets are
   * the notes and diagrams they link to or embed.
   */
  constructor(
    private readonly changed: (snapshot: LinkIndexSnapshot) => void = () => {},
    private readonly diagrams?: DiagramTextSource,
  ) {}

  snapshot(): LinkIndexSnapshot {
    const backlinks = new Map<string, string[]>();
    for (const [source, targets] of this.outgoing)
      for (const target of targets) {
        const sources = backlinks.get(target) ?? [];
        sources.push(source);
        backlinks.set(target, sources);
      }
    return { outgoing: new Map(this.outgoing), backlinks };
  }
  update(note: Note) {
    this.updateMany([note]);
  }
  updateMany(notes: readonly Note[]) {
    for (const note of notes) {
      this.mutations.set(note.relativePath, ++this.revision);
      this.outgoing.set(
        note.relativePath,
        new Set(scanNoteLinks(note.content).map((link) => link.path)),
      );
    }
    this.changed(this.snapshot());
  }
  /** A diagram's element links, from its in-memory scene after a save. */
  updateDiagram(path: string, targets: readonly string[]) {
    this.mutations.set(path, ++this.revision);
    this.outgoing.set(path, new Set(targets));
    this.changed(this.snapshot());
  }
  remove(path: string) {
    this.mutations.set(path, ++this.revision);
    for (const source of this.outgoing.keys())
      if (isInsideFolder(source, path)) this.outgoing.delete(source);
    this.changed(this.snapshot());
  }
  async rebuild(
    repository: NoteRepository,
    notes?: readonly NoteSummary[],
    diagrams?: readonly DiagramSummary[],
  ): Promise<RepositoryResult<void>> {
    const revision = this.revision;
    const identifier = ++this.scanIdentifier;
    const outgoing = new Map<string, ReadonlySet<string>>();
    const errors: { path: string; error: RepositoryError }[] = [];
    if (!notes) {
      const tree = await repository.listTree();
      if (!tree.ok) return tree;
      const hydrated = await (repository.hydrateTree?.() ?? Promise.resolve(tree));
      if (!hydrated.ok) return hydrated;
      notes = hydrated.value.notes;
      diagrams ??= hydrated.value.diagrams;
    }
    if (this.diagrams && !diagrams) {
      const tree = await repository.listTree();
      diagrams = tree.ok ? tree.value.diagrams : [];
    }
    let scanned = 0;
    for (const note of notes) {
      if (identifier !== this.scanIdentifier) return success(undefined);
      const read = await (repository.readSnapshotNote?.(note.relativePath, note) ??
        repository.readNote(note.relativePath));
      if (read.ok)
        outgoing.set(
          note.relativePath,
          new Set(scanNoteLinks(read.value.content).map((link) => link.path)),
        );
      else errors.push({ path: note.relativePath, error: read.error });
      if (++scanned % 20 === 0) await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    for (const diagram of this.diagrams ? (diagrams ?? []) : []) {
      if (identifier !== this.scanIdentifier) return success(undefined);
      const read = await this.diagrams?.readDiagramText(diagram.relativePath);
      if (read?.ok) outgoing.set(diagram.relativePath, new Set(diagramElementLinks(read.value)));
      else if (read) errors.push({ path: diagram.relativePath, error: read.error });
      if (++scanned % 20 === 0) await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    if (identifier !== this.scanIdentifier) return success(undefined);
    // Concurrent saves/deletions take precedence over the scan's older snapshot.
    for (const [path, changedAt] of this.mutations) {
      if (changedAt <= revision) continue;
      for (const source of outgoing.keys())
        if (isInsideFolder(source, path)) outgoing.delete(source);
      for (const [source, targets] of this.outgoing)
        if (isInsideFolder(source, path)) outgoing.set(source, targets);
    }
    this.outgoing = outgoing;
    this.changed(this.snapshot());
    const unresolved = errors.filter(
      ({ path }) =>
        ![...this.mutations].some(
          ([changedPath, changedAt]) => changedAt > revision && isInsideFolder(path, changedPath),
        ),
    );
    for (const [path, changedAt] of this.mutations)
      if (changedAt <= revision) this.mutations.delete(path);
    return unresolved.length
      ? failure({
          code: 'io-error',
          message: `Could not index links in ${unresolved.length} note(s).`,
          detail: unresolved.map(({ error }) => error.message).join('\n'),
        })
      : success(undefined);
  }
  scheduleRebuild(repository: NoteRepository, report: (error: RepositoryError) => void) {
    this.scanIdentifier += 1;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.rebuild(repository)
        .then((result) => {
          if (!result.ok) report(result.error);
        })
        .catch((error: unknown) =>
          report(describeStorageError(error, 'Could not refresh note links.')),
        );
    }, 180);
  }
  cancel() {
    this.scanIdentifier += 1;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
