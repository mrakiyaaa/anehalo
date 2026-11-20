import { SerialTaskQueue } from '@/features/storage/autosave/SerialTaskQueue';
import {
  SAVE_DEBOUNCE_MS,
  retryDelay,
  type SaveStatus,
} from '@/features/storage/autosave/save-timing';
import {
  failure,
  success,
  type RepositoryError,
  type RepositoryResult,
} from '@/features/storage/repository-result';
import type { DiagramSummary } from '@/types/notes';
import type { DiagramScene } from './diagram-codec';
import type { DiagramRepository, LoadedDiagram } from './DiagramRepository';

export interface DiagramDraft {
  readonly summary: DiagramSummary;
  /** The latest drawing; it may be ahead of the file while a save is pending. */
  readonly scene: DiagramScene;
  /** The drawing as last loaded from disk, which is what the canvas starts from. */
  readonly loadedScene: DiagramScene;
  readonly dirty: boolean;
  readonly status: SaveStatus;
  readonly error: RepositoryError | null;
  /** The file changed outside Anehalo while this drawing had unsaved changes. */
  readonly hasExternalChange: boolean;
  readonly isMissing: boolean;
  /** Increases when the drawing is replaced from disk, so the canvas reloads it. */
  readonly documentVersion: number;
}

interface DiagramSession {
  draft: DiagramDraft;
  /** The file's text and time as last read or written by Anehalo. */
  savedText: string;
  savedModifiedAt: number;
  changeCount: number;
  savedChangeCount: number;
  timer: ReturnType<typeof setTimeout> | null;
  retryCount: number;
}

const conflictError: RepositoryError = {
  code: 'conflict',
  message: 'This diagram changed outside Anehalo. Choose which version to keep.',
};
const missingError: RepositoryError = {
  code: 'not-found',
  message: 'This diagram was deleted or renamed outside Anehalo. Your drawing is still here.',
};
/** These need the user to decide, so they are never retried automatically. */
const decisionErrors: ReadonlySet<RepositoryError['code']> = new Set([
  'conflict',
  'not-found',
  'invalid-diagram',
]);

/**
 * Saves the open diagram the way notes are saved: after a quiet moment, one save at a time,
 * retried with backoff, never over a newer file written outside Anehalo, and before closing.
 */
export class DiagramAutoSaver {
  private session: DiagramSession | null = null;
  private readonly tasks = new SerialTaskQueue();
  private readonly listeners = new Set<(draft: DiagramDraft | null) => void>();
  private paused = false;

  constructor(private readonly repository: DiagramRepository) {}

  subscribe(listener: (draft: DiagramDraft | null) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  get draft(): DiagramDraft | null {
    return this.session?.draft ?? null;
  }

  private publish(session: DiagramSession, changes: Partial<DiagramDraft>) {
    session.draft = {
      ...session.draft,
      ...changes,
      dirty: session.changeCount !== session.savedChangeCount,
    };
    if (session === this.session) for (const listener of this.listeners) listener(session.draft);
  }

  private clearTimer(session: DiagramSession) {
    if (session.timer !== null) clearTimeout(session.timer);
    session.timer = null;
  }

  private schedule(session: DiagramSession, delay = SAVE_DEBOUNCE_MS) {
    this.clearTimer(session);
    const { draft } = session;
    if (this.paused || !draft.dirty || draft.hasExternalChange || draft.isMissing) return;
    session.timer = setTimeout(() => {
      session.timer = null;
      void this.flush();
    }, delay);
  }

  private failed(session: DiagramSession, error: RepositoryError): RepositoryResult<never> {
    this.clearTimer(session);
    this.publish(session, {
      error,
      status: 'retrying',
      isMissing: error.code === 'not-found' || session.draft.isMissing,
      hasExternalChange: error.code === 'conflict' || session.draft.hasExternalChange,
    });
    if (!decisionErrors.has(error.code)) {
      const delay = retryDelay(session.retryCount);
      session.retryCount += 1;
      this.schedule(session, delay);
    }
    return failure(error);
  }

  private replaceFromDisk(session: DiagramSession, loaded: LoadedDiagram) {
    this.clearTimer(session);
    session.savedText = loaded.text;
    session.savedModifiedAt = loaded.summary.modifiedAt;
    session.savedChangeCount = session.changeCount;
    session.retryCount = 0;
    this.publish(session, {
      summary: loaded.summary,
      scene: loaded.scene,
      loadedScene: loaded.scene,
      status: 'saved',
      error: null,
      hasExternalChange: false,
      isMissing: false,
      documentVersion: session.draft.documentVersion + 1,
    });
  }

  /** Opens a loaded diagram, saving and closing the previous one first. */
  open(loaded: LoadedDiagram): Promise<RepositoryResult<DiagramDraft>> {
    return this.tasks.run(async () => {
      const closed = await this.closeSession();
      if (!closed.ok) return closed;
      const draft: DiagramDraft = {
        summary: loaded.summary,
        scene: loaded.scene,
        loadedScene: loaded.scene,
        dirty: false,
        status: 'saved',
        error: null,
        hasExternalChange: false,
        isMissing: false,
        documentVersion: 0,
      };
      this.session = {
        draft,
        savedText: loaded.text,
        savedModifiedAt: loaded.summary.modifiedAt,
        changeCount: 0,
        savedChangeCount: 0,
        timer: null,
        retryCount: 0,
      };
      for (const listener of this.listeners) listener(draft);
      return success(draft);
    });
  }

  /** Records a real document change (the canvas filters out zoom, selection and the like). */
  update(scene: DiagramScene) {
    const session = this.session;
    if (!session) return;
    session.changeCount += 1;
    this.publish(session, { scene, status: session.draft.error ? 'retrying' : 'saving' });
    this.schedule(session);
  }

  /** Compares the file with what Anehalo last read or wrote, reading it only if its time moved. */
  private async inspect(session: DiagramSession): Promise<RepositoryResult<void>> {
    const modifiedAt = await this.repository.diagramModifiedAt(session.draft.summary.relativePath);
    if (!modifiedAt.ok) return this.failed(session, modifiedAt.error);
    if (modifiedAt.value === null) return this.failed(session, missingError);
    if (session.draft.isMissing) this.publish(session, { isMissing: false, error: null });
    if (modifiedAt.value === session.savedModifiedAt) return success(undefined);
    const latest = await this.repository.readDiagram(session.draft.summary.relativePath);
    if (!latest.ok && latest.error.code !== 'invalid-diagram')
      return this.failed(session, latest.error);
    if (latest.ok && latest.value.text === session.savedText) {
      session.savedModifiedAt = latest.value.summary.modifiedAt;
      return success(undefined);
    }
    if (session.draft.dirty || !latest.ok) return this.failed(session, conflictError);
    this.replaceFromDisk(session, latest.value);
    return success(undefined);
  }

  private async save(session: DiagramSession): Promise<RepositoryResult<void>> {
    this.clearTimer(session);
    while (session.draft.dirty) {
      if (session.draft.hasExternalChange || session.draft.isMissing)
        return failure(session.draft.error ?? conflictError);
      const inspected = await this.inspect(session);
      if (!inspected.ok) return inspected;
      if (!session.draft.dirty) break;
      const capturedChange = session.changeCount;
      this.publish(session, { status: 'saving' });
      const written = await this.repository.writeDiagram(
        session.draft.summary.relativePath,
        session.draft.scene,
      );
      if (!written.ok) return this.failed(session, written.error);
      session.savedText = written.value.text;
      session.savedModifiedAt = written.value.summary.modifiedAt;
      session.savedChangeCount = capturedChange;
      session.retryCount = 0;
      this.publish(session, {
        summary: written.value.summary,
        status: session.changeCount === capturedChange ? 'saved' : 'saving',
        error: null,
      });
    }
    return success(undefined);
  }

  flush(): Promise<RepositoryResult<void>> {
    return this.tasks.run(async () =>
      this.session ? this.save(this.session) : success(undefined),
    );
  }

  checkExternal(): Promise<RepositoryResult<void>> {
    return this.tasks.run(async () => {
      const session = this.session;
      if (!session) return success(undefined);
      const inspected = await this.inspect(session);
      if (inspected.ok) this.schedule(session);
      return inspected;
    });
  }

  resolveConflict(choice: 'mine' | 'theirs'): Promise<RepositoryResult<void>> {
    return this.tasks.run(async () => {
      const session = this.session;
      if (!session?.draft.hasExternalChange) return success(undefined);
      if (choice === 'theirs') {
        const latest = await this.repository.readDiagram(session.draft.summary.relativePath);
        if (!latest.ok) return this.failed(session, latest.error);
        this.replaceFromDisk(session, latest.value);
        return success(undefined);
      }
      const modifiedAt = await this.repository.diagramModifiedAt(
        session.draft.summary.relativePath,
      );
      if (!modifiedAt.ok) return this.failed(session, modifiedAt.error);
      // Keeping mine accepts the outside file's time as the baseline, then writes over it.
      session.savedModifiedAt = modifiedAt.value ?? session.savedModifiedAt;
      this.publish(session, { hasExternalChange: false, error: null });
      return this.save(session);
    });
  }

  private async closeSession(): Promise<RepositoryResult<void>> {
    const session = this.session;
    if (!session) return success(undefined);
    const saved = await this.save(session);
    if (!saved.ok) return saved;
    this.clearTimer(session);
    this.session = null;
    for (const listener of this.listeners) listener(null);
    return success(undefined);
  }

  /** Saves and closes the open diagram; it stays open if the save fails. */
  close(): Promise<RepositoryResult<void>> {
    return this.tasks.run(() => this.closeSession());
  }

  /** Drops the open diagram without saving, after it was moved to trash on purpose. */
  forget(relativePath: string) {
    if (this.session?.draft.summary.relativePath !== relativePath) return;
    this.clearTimer(this.session);
    this.session = null;
    for (const listener of this.listeners) listener(null);
  }

  /** Follows a rename or move made in Anehalo, so saves go to the new path. */
  relocate(previousPath: string, summary: DiagramSummary) {
    const session = this.session;
    if (session?.draft.summary.relativePath !== previousPath) return;
    session.savedModifiedAt = summary.modifiedAt;
    this.publish(session, { summary });
  }

  pause() {
    this.paused = true;
    if (this.session) this.clearTimer(this.session);
  }

  resume() {
    this.paused = false;
    if (this.session) this.schedule(this.session);
  }
}
