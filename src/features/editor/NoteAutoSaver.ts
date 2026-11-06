import {
  createNoteDraft,
  hasDraftChanges,
  noteChanged,
  type NoteDraft,
} from '@/features/editor/NoteDraft';
import { persistNoteDraft } from '@/features/editor/persist-note-draft';
import type { NoteRepository } from '@/features/storage/NoteRepository';
import {
  describeStorageError,
  failure,
  success,
  type RepositoryError,
  type RepositoryResult,
} from '@/features/storage/repository-result';
import { isInsideFolder, pathName, parentPath } from '@/features/storage/storage-paths';
import type { Note } from '@/types/notes';
import {
  renamedLink,
  rewriteNoteLinks,
  type LinkRename,
} from '@/features/note-links/NoteLinkRewriter';

interface DraftSession {
  draft: NoteDraft;
  timer: ReturnType<typeof setTimeout> | null;
  retryCount: number;
  releaseWhenSaved: boolean;
  lastEditedAt: number;
}

export interface DraftChange {
  readonly draft: NoteDraft;
  readonly previousPath: string;
}

const conflictError: RepositoryError = {
  code: 'conflict',
  message: 'This note changed outside Anehalo. Choose which version to keep.',
};

export class NoteAutoSaver {
  private readonly sessions = new Map<string, DraftSession>();
  private readonly listeners = new Set<(change: DraftChange) => void>();
  private queue: Promise<void> = Promise.resolve();
  private paused = false;

  constructor(private readonly repository: NoteRepository) {}

  subscribe(listener: (change: DraftChange) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  drafts(): readonly NoteDraft[] {
    return [...this.sessions.values()].map((session) => session.draft);
  }
  get(identifier: string): NoteDraft | null {
    return this.sessions.get(identifier)?.draft ?? null;
  }

  private run<Value>(
    operation: () => Promise<RepositoryResult<Value>>,
  ): Promise<RepositoryResult<Value>> {
    const task = this.queue.then(async () => {
      try {
        return await operation();
      } catch (error) {
        const described = describeStorageError(error, 'Could not save the note.');
        for (const session of this.sessions.values())
          if (session.draft.dirty) this.failed(session, described);
        return failure(described);
      }
    });
    this.queue = task.then(() => undefined);
    return task;
  }

  private publish(
    session: DraftSession,
    changes: Partial<NoteDraft>,
    previousPath = session.draft.note.relativePath,
  ) {
    const draft = { ...session.draft, ...changes };
    session.draft = { ...draft, dirty: hasDraftChanges(draft) };
    for (const listener of this.listeners) listener({ draft: session.draft, previousPath });
  }

  private clearTimer(session: DraftSession) {
    if (session.timer !== null) clearTimeout(session.timer);
    session.timer = null;
  }

  private schedule(session: DraftSession, delay = 500) {
    this.clearTimer(session);
    if (
      this.paused ||
      !session.draft.dirty ||
      session.draft.externalNote ||
      session.draft.isMissing ||
      session.draft.isSerializationBlocked
    )
      return;
    session.timer = setTimeout(() => {
      session.timer = null;
      void this.flush(session.draft.identifier);
    }, delay);
  }

  private failed(session: DraftSession, error: RepositoryError): RepositoryResult<never> {
    this.clearTimer(session);
    const isMissing = error.code === 'not-found' || session.draft.isMissing;
    this.publish(session, { error, isMissing, status: 'retrying' });
    if (!isMissing && error.code !== 'conflict' && error.code !== 'invalid-name') {
      const delay = Math.min(1000 * 2 ** session.retryCount, 30000);
      session.retryCount += 1;
      this.schedule(session, delay);
    }
    return failure(error);
  }

  load(relativePath: string): Promise<RepositoryResult<NoteDraft>> {
    return this.run(async () => {
      const existing = [...this.sessions.values()].find(
        (session) => session.draft.note.relativePath === relativePath,
      );
      if (existing?.draft.dirty) {
        existing.releaseWhenSaved = false;
        return success(existing.draft);
      }
      const result = await this.repository.readNote(relativePath);
      if (!result.ok) return result;
      const draft = createNoteDraft(result.value, existing?.draft.identifier);
      if (existing) this.clearTimer(existing);
      this.sessions.set(draft.identifier, {
        draft,
        timer: null,
        retryCount: 0,
        releaseWhenSaved: false,
        lastEditedAt: 0,
      });
      return success(draft);
    });
  }

  update(identifier: string, changes: Partial<Pick<NoteDraft, 'content' | 'title'>>) {
    const session = this.sessions.get(identifier);
    if (!session) return;
    if (
      !session.draft.isSerializationBlocked &&
      (changes.content === undefined || changes.content === session.draft.content) &&
      (changes.title === undefined || changes.title === session.draft.title)
    )
      return;
    session.lastEditedAt = Date.now();
    this.publish(session, {
      ...changes,
      isSerializationBlocked: 'content' in changes ? false : session.draft.isSerializationBlocked,
      status: session.draft.error ? 'retrying' : 'saving',
    });
    if (!session.draft.dirty) this.publish(session, { status: 'saved', error: null });
    this.schedule(session);
  }

  reportContentError(identifier: string, error: RepositoryError) {
    const session = this.sessions.get(identifier);
    if (!session) return;
    this.clearTimer(session);
    this.publish(session, { error, isSerializationBlocked: true, status: 'retrying' });
  }

  private replaceFromDisk(session: DraftSession, note: Note) {
    this.clearTimer(session);
    session.retryCount = 0;
    this.publish(session, {
      ...createNoteDraft(note, session.draft.identifier),
      documentVersion: session.draft.documentVersion + 1,
    });
  }

  private async inspect(session: DraftSession): Promise<RepositoryResult<void>> {
    const result = await this.repository.readNote(session.draft.note.relativePath);
    if (!result.ok) return this.failed(session, result.error);
    if (noteChanged(session.draft.note, result.value)) {
      if (session.draft.dirty) {
        this.clearTimer(session);
        this.publish(session, {
          externalNote: result.value,
          error: conflictError,
          isMissing: false,
        });
        return failure(conflictError);
      }
      this.replaceFromDisk(session, result.value);
    } else if (session.draft.isMissing || (session.draft.error && !session.draft.dirty)) {
      this.publish(session, {
        isMissing: false,
        error: null,
        status: session.draft.dirty ? 'saving' : 'saved',
      });
      this.schedule(session);
    }
    return success(undefined);
  }

  checkExternal(identifier: string): Promise<RepositoryResult<void>> {
    return this.run(async () => {
      const session = this.sessions.get(identifier);
      return session ? this.inspect(session) : success(undefined);
    });
  }

  private async saveSession(
    session: DraftSession,
    includeTitle = true,
  ): Promise<RepositoryResult<void>> {
    this.clearTimer(session);
    while (
      session.draft.dirty &&
      (includeTitle ||
        session.draft.content !== session.draft.note.content ||
        session.draft.isSerializationBlocked)
    ) {
      if (
        session.draft.isSerializationBlocked ||
        session.draft.externalNote ||
        session.draft.isMissing
      )
        return failure(session.draft.error ?? conflictError);
      const inspected = await this.inspect(session);
      if (!inspected.ok) return inspected;
      const captured = includeTitle
        ? session.draft
        : { ...session.draft, title: session.draft.note.title };
      this.publish(session, { status: 'saving' });
      const result = await persistNoteDraft(this.repository, captured, (note, renamed) => {
        this.publish(session, {
          note,
          title:
            renamed && session.draft.title === captured.title ? note.title : session.draft.title,
        });
      });
      if (!result.ok) return this.failed(session, result.error);
      session.retryCount = 0;
      this.publish(session, { status: session.draft.dirty ? 'saving' : 'saved', error: null });
    }
    if (session.draft.dirty)
      this.schedule(session, Math.max(0, session.lastEditedAt + 500 - Date.now()));
    else {
      this.clearTimer(session);
      if (session.draft.status !== 'saved' && !session.draft.error)
        this.publish(session, { status: 'saved' });
      if (session.releaseWhenSaved) this.sessions.delete(session.draft.identifier);
    }
    return success(undefined);
  }

  flush(identifier: string): Promise<RepositoryResult<void>> {
    return this.run(async () => {
      const session = this.sessions.get(identifier);
      return session ? this.saveSession(session) : success(undefined);
    });
  }

  flushContent(identifier: string): Promise<RepositoryResult<void>> {
    return this.run(async () => {
      const session = this.sessions.get(identifier);
      return session ? this.saveSession(session, false) : success(undefined);
    });
  }

  private async saveEverySession(): Promise<RepositoryResult<void>> {
    let firstError: RepositoryError | null = null;
    for (const session of this.sessions.values()) {
      const result = await this.saveSession(session);
      if (!result.ok) firstError ??= result.error;
    }
    return firstError ? failure(firstError) : success(undefined);
  }

  flushAll(): Promise<RepositoryResult<void>> {
    return this.run(() => this.saveEverySession());
  }

  withSavedNotes<Value>(
    operation: () => Promise<RepositoryResult<Value>>,
    accept?: (value: Value) => void,
  ): Promise<RepositoryResult<Value>> {
    return this.run(async () => {
      const saved = await this.saveEverySession();
      if (!saved.ok) return saved;
      const result = await operation();
      if (result.ok) accept?.(result.value);
      return result;
    });
  }

  resolveConflict(identifier: string, choice: 'mine' | 'theirs'): Promise<RepositoryResult<void>> {
    return this.run(async () => {
      const session = this.sessions.get(identifier);
      if (!session?.draft.externalNote) return success(undefined);
      if (choice === 'theirs') {
        const latest = await this.repository.readNote(session.draft.note.relativePath);
        if (!latest.ok) return this.failed(session, latest.error);
        this.replaceFromDisk(session, latest.value);
      } else {
        this.publish(session, {
          note: session.draft.externalNote,
          externalNote: null,
          error: null,
        });
        return this.saveSession(session);
      }
      return success(undefined);
    });
  }

  recoverAsNewNote(identifier: string): Promise<RepositoryResult<void>> {
    return this.run(async () => {
      const session = this.sessions.get(identifier);
      if (!session?.draft.isMissing) return success(undefined);
      if (session.draft.isSerializationBlocked)
        return failure(session.draft.error ?? conflictError);
      const captured = session.draft;
      let created = await this.repository.createNote({
        title: captured.title,
        folder: captured.note.folder,
        content: captured.content,
      });
      if (!created.ok && created.error.code === 'not-found' && captured.note.folder)
        created = await this.repository.createNote({
          title: captured.title,
          content: captured.content,
        });
      if (!created.ok) return this.failed(session, created.error);
      this.publish(session, {
        note: created.value,
        title: session.draft.title === captured.title ? created.value.title : session.draft.title,
        isMissing: false,
        externalNote: null,
        error: null,
      });
      return this.saveSession(session);
    });
  }

  acceptRenamedNote(previousPath: string, note: Note) {
    for (const session of this.sessions.values()) {
      if (session.draft.note.relativePath === previousPath)
        this.publish(session, {
          note,
          title:
            session.draft.title === session.draft.note.title ? note.title : session.draft.title,
        });
    }
  }

  acceptLinkRename(rename: LinkRename, notes: ReadonlyMap<string, Note>) {
    for (const session of this.sessions.values()) {
      const draft = session.draft;
      const path =
        renamedLink(draft.note.relativePath, '', rename)?.path ?? draft.note.relativePath;
      const note = notes.get(path);
      // Failed files retain their original baseline and can be retried by the normal save queue.
      const content = rewriteNoteLinks(draft.content, rename);
      const externallyChanged =
        note && rewriteNoteLinks(draft.note.content, rename) !== note.content;
      this.publish(session, {
        note: externallyChanged
          ? {
              ...draft.note,
              relativePath: note.relativePath,
              folder: note.folder,
              title: note.title,
            }
          : (note ?? draft.note),
        title: note && draft.title === draft.note.title ? note.title : draft.title,
        content,
        linkRenames: [...draft.linkRenames, rename],
        ...(externallyChanged
          ? { externalNote: note, error: conflictError, status: 'retrying' as const }
          : {}),
      });
      this.schedule(session);
    }
  }

  relocateFolder(previousPath: string, nextPath: string) {
    for (const session of this.sessions.values()) {
      const note = session.draft.note;
      if (!isInsideFolder(note.relativePath, previousPath)) continue;
      const relativePath = `${nextPath}${note.relativePath.slice(previousPath.length)}`;
      this.publish(session, {
        note: {
          ...note,
          relativePath,
          title: pathName(relativePath).replace(/\.md$/i, ''),
          folder: parentPath(relativePath) || null,
        },
      });
    }
  }

  forgetDeletedPath(path: string) {
    for (const session of this.sessions.values()) {
      if (!isInsideFolder(session.draft.note.relativePath, path)) continue;
      if (session.draft.dirty)
        this.failed(session, {
          code: 'not-found',
          message: 'This note was deleted. Your unsaved text is still here.',
        });
      else {
        this.clearTimer(session);
        this.sessions.delete(session.draft.identifier);
      }
    }
  }

  release(identifier: string) {
    const session = this.sessions.get(identifier);
    if (session?.draft.dirty) session.releaseWhenSaved = true;
    if (session && !session.draft.dirty) {
      this.clearTimer(session);
      this.sessions.delete(identifier);
    }
  }

  pause() {
    this.paused = true;
    for (const session of this.sessions.values()) this.clearTimer(session);
  }
  resume() {
    this.paused = false;
    for (const session of this.sessions.values()) this.schedule(session);
  }
}
