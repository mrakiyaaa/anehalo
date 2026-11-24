import { isInsideFolder } from '@/features/storage/storage-paths';
import {
  failure,
  success,
  type RepositoryError,
  type RepositoryResult,
} from '@/features/storage/repository-result';
import type { DiagramSummary } from '@/types/notes';

/** Reads diagrams' stored text without parsing it, and so without loading Excalidraw. */
export interface DiagramTextSource {
  /** One result per path for a leading part of the list, always at least one. */
  readDiagramTexts(paths: readonly string[]): Promise<readonly RepositoryResult<string>[]>;
}

/** An element as stored in a diagram file: only the fields indexes read are typed. */
export interface StoredElement {
  readonly id?: unknown;
  readonly type?: unknown;
  readonly isDeleted?: unknown;
  /** Writable: renames rewrite element links in place. */
  link?: unknown;
  readonly text?: unknown;
  readonly originalText?: unknown;
  readonly containerId?: unknown;
  readonly name?: unknown;
}

/** Something kept in step with diagram contents: the link index and the search index. */
export interface DiagramContentListener {
  /** The stored text of a diagram that is new, or changed since it was last read. */
  diagramRead(diagram: DiagramSummary, text: string): void;
  /** An in-app save: the in-memory elements, so the file is not read again. */
  diagramSaved(diagram: DiagramSummary, elements: readonly StoredElement[]): void;
  /** No longer in the vault, for example deleted outside Anehalo. */
  diagramRemoved(path: string): void;
}

const yieldToInput = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * Diagrams asked for per read. Each read is one IPC round trip, which costs a few milliseconds
 * whatever its size, so diagrams are read in batches; the reader also caps a batch's bytes.
 */
export const DIAGRAM_READ_BATCH = 20;

/**
 * The one place that reads diagram files for indexing. Each file is read once per version (its
 * modified time), and what was read is handed to every listener, so indexes never read on their
 * own.
 */
export class DiagramContentScan {
  private readonly versions = new Map<string, number>();
  private readonly mutations = new Map<string, number>();
  private revision = 0;
  private scanIdentifier = 0;
  /** Diagram files read since the scan was created; startup budgets report it. */
  reads = 0;

  constructor(
    private readonly reader: DiagramTextSource,
    private readonly listeners: readonly DiagramContentListener[],
  ) {}

  async scan(diagrams: readonly DiagramSummary[]): Promise<RepositoryResult<void>> {
    const identifier = ++this.scanIdentifier;
    const listed = new Set(diagrams.map((diagram) => diagram.relativePath));
    const errors: RepositoryError[] = [];
    const unread = (diagram: DiagramSummary) =>
      this.versions.get(diagram.relativePath) !== diagram.modifiedAt;
    let next = 0;
    let carried: DiagramSummary[] = [];
    for (;;) {
      // Checked again just before reading: a save during the previous batch is already known.
      const batch = carried.filter(unread);
      while (batch.length < DIAGRAM_READ_BATCH && next < diagrams.length) {
        const diagram = diagrams[next++];
        if (diagram && unread(diagram)) batch.push(diagram);
      }
      if (!batch.length) break;
      const revisions = batch.map((diagram) => this.mutations.get(diagram.relativePath));
      const texts = await this.reader.readDiagramTexts(
        batch.map((diagram) => diagram.relativePath),
      );
      if (identifier !== this.scanIdentifier) return success(undefined);
      if (!texts.length) {
        errors.push({ code: 'io-error', message: 'The diagram reader returned nothing.' });
        break;
      }
      texts.forEach((text, index) => {
        const diagram = batch[index];
        if (!diagram) return;
        this.reads += 1;
        // A save or rename while the file was read is newer than what was read.
        if (this.mutations.get(diagram.relativePath) !== revisions[index]) return;
        if (text.ok) {
          this.versions.set(diagram.relativePath, diagram.modifiedAt);
          for (const listener of this.listeners) listener.diagramRead(diagram, text.value);
        } else errors.push(text.error);
      });
      carried = batch.slice(texts.length);
      await yieldToInput();
    }
    if (identifier !== this.scanIdentifier) return success(undefined);
    for (const path of [...this.versions.keys()])
      if (!listed.has(path)) {
        this.versions.delete(path);
        for (const listener of this.listeners) listener.diagramRemoved(path);
      }
    return errors.length
      ? failure({
          code: 'io-error',
          message: `Could not read ${errors.length} diagram(s) for search and links.`,
          detail: errors.map((error) => error.message).join('\n'),
        })
      : success(undefined);
  }

  saved(diagram: DiagramSummary, elements: readonly StoredElement[]) {
    this.mutations.set(diagram.relativePath, ++this.revision);
    this.versions.set(diagram.relativePath, diagram.modifiedAt);
    for (const listener of this.listeners) listener.diagramSaved(diagram, elements);
  }

  /** A rename or move inside Anehalo: the content is unchanged, so it is not read again. */
  relocate(previousPath: string, nextPath: string) {
    for (const [path, version] of [...this.versions]) {
      if (!isInsideFolder(path, previousPath)) continue;
      const moved = `${nextPath}${path.slice(previousPath.length)}`;
      this.versions.delete(path);
      this.versions.set(moved, version);
      this.mutations.set(path, ++this.revision);
      this.mutations.set(moved, ++this.revision);
    }
  }

  /** Trashed in Anehalo: forgotten, so a restore reads it again. */
  forget(path: string) {
    for (const known of [...this.versions.keys()])
      if (isInsideFolder(known, path)) {
        this.versions.delete(known);
        this.mutations.set(known, ++this.revision);
      }
  }

  cancel() {
    this.scanIdentifier += 1;
  }
}
