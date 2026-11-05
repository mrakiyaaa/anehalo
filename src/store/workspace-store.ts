import { createStore } from 'zustand/vanilla';
import type { NoteRepository } from '@/features/storage/NoteRepository';
import {
  describeStorageError,
  failure,
  success,
  type RepositoryResult,
} from '@/features/storage/repository-result';
import { isInsideFolder } from '@/features/storage/storage-paths';
import { NoteAutoSaver } from '@/features/editor/NoteAutoSaver';
import type { WorkspaceOptions, WorkspaceState } from '@/store/workspace-state';

export function createWorkspaceStore(repository: NoteRepository, options: WorkspaceOptions = {}) {
  const autoSaver = new NoteAutoSaver(repository);
  let initialized = false;
  let lastOpenedPath = options.lastOpenedNotePath ?? null;
  async function rememberNote(path: string | null) {
    lastOpenedPath = path;
    await options.rememberNote?.(path);
  }
  const store = createStore<WorkspaceState>()((set, get) => {
    let operationQueue: Promise<void> = Promise.resolve();
    let pendingOperations = 0;
    let refreshIdentifier = 0;

    async function refreshTree() {
      const requestIdentifier = ++refreshIdentifier;
      set({ isLoading: true });
      const result = await repository.listTree();
      if (requestIdentifier === refreshIdentifier) {
        if (result.ok)
          set({
            tree: result.value,
            isLoading: false,
            activeFolderPath: result.value.folders.some(
              (folder) => folder.relativePath === get().activeFolderPath,
            )
              ? get().activeFolderPath
              : null,
          });
        else set({ error: result.error, isLoading: false });
      }
      return result;
    }

    function enqueue<Value>(
      operation: () => Promise<RepositoryResult<Value>>,
    ): Promise<RepositoryResult<Value>> {
      if (get().isClosing)
        return Promise.resolve(
          failure({
            code: 'unavailable',
            message: 'Anehalo is finishing pending saves before closing.',
          }),
        );
      pendingOperations += 1;
      set({ isMutating: true, error: null });
      const task = operationQueue.then(async () => {
        try {
          return await operation();
        } catch (error) {
          const result = failure(describeStorageError(error, 'Could not complete the change.'));
          if (!result.ok) set({ error: result.error });
          return result;
        } finally {
          pendingOperations -= 1;
          set({ isMutating: pendingOperations > 0 });
        }
      });
      operationQueue = task.then(() => undefined);
      return task;
    }

    async function leaveCurrentDraft(): Promise<RepositoryResult<void>> {
      const draft = get().openDraft;
      if (!draft) return success(undefined);
      const saved = await autoSaver.flush(draft.identifier);
      if (!saved.ok && autoSaver.get(draft.identifier)?.isSerializationBlocked) return saved;
      return success(undefined);
    }

    async function loadNote(path: string): Promise<RepositoryResult<void>> {
      const previousIdentifier = get().openDraft?.identifier;
      const left = await leaveCurrentDraft();
      if (!left.ok) return left;
      set({ isOpeningNote: true, view: 'editor', openingError: null });
      const loaded = await autoSaver.load(path);
      if (!loaded.ok) set({ openDraft: null, isOpeningNote: false, openingError: loaded.error });
      else {
        set({ openDraft: loaded.value, isOpeningNote: false });
        await rememberNote(loaded.value.note.relativePath);
      }
      if (previousIdentifier && (!loaded.ok || loaded.value.identifier !== previousIdentifier))
        autoSaver.release(previousIdentifier);
      return loaded.ok ? success(undefined) : loaded;
    }

    function mutate<Value>(
      operation: () => Promise<RepositoryResult<Value>>,
      accept?: (value: Value) => void,
    ) {
      return enqueue(async () => {
        const result = await autoSaver.withSavedNotes(operation, accept);
        if (!result.ok) set({ error: result.error });
        else {
          const current = get().openDraft;
          if (current && !autoSaver.get(current.identifier)) {
            set({ openDraft: null, view: 'home' });
            await rememberNote(null);
          }
          set({ pendingDrafts: autoSaver.drafts().filter((draft) => draft.dirty) });
          await refreshTree();
        }
        return result;
      });
    }

    return {
      tree: { vaultPath: '', folders: [], notes: [] },
      activeFolderPath: null,
      searchText: '',
      isLoading: true,
      isMutating: false,
      isClosing: false,
      error: null,
      view: 'home',
      openDraft: null,
      pendingDrafts: [],
      isOpeningNote: false,
      openingError: null,
      selectFolder: (activeFolderPath) => set({ activeFolderPath }),
      setSearchText: (searchText) => set({ searchText }),
      dismissError: () => set({ error: null }),
      reportError: (error) => set({ error }),
      refreshTree,
      initialize: async () => {
        if (initialized) return;
        initialized = true;
        const tree = await refreshTree();
        if (tree.ok && options.reopenLastNote !== false && options.lastOpenedNotePath)
          await get().openNote(options.lastOpenedNotePath);
      },
      openNote: (path) => enqueue(() => loadNote(path)),
      goHome: () =>
        enqueue(async () => {
          const saved = await leaveCurrentDraft();
          if (!saved.ok) return saved;
          const identifier = get().openDraft?.identifier;
          if (identifier) autoSaver.release(identifier);
          set({ view: 'home', openDraft: null, openingError: null });
          return success(undefined);
        }),
      startQuickNote: (content = '') =>
        enqueue(async () => {
          const left = await leaveCurrentDraft();
          if (!left.ok) return left;
          const result = await repository.createNote({ folder: get().activeFolderPath, content });
          if (!result.ok) set({ error: result.error });
          else {
            await refreshTree();
            await loadNote(result.value.relativePath);
          }
          return result;
        }),
      updateNoteContent: (identifier, content) => autoSaver.update(identifier, { content }),
      updateNoteTitle: (identifier, title) => autoSaver.update(identifier, { title }),
      reportContentError: (identifier, error) => autoSaver.reportContentError(identifier, error),
      saveNote: (identifier) => autoSaver.flush(identifier),
      saveNoteContent: (identifier) => autoSaver.flushContent(identifier),
      flushNotes: async () => {
        await operationQueue;
        return autoSaver.flushAll();
      },
      checkOpenNote: async () => {
        const current = get().openDraft;
        return current ? autoSaver.checkExternal(current.identifier) : success(undefined);
      },
      resolveConflict: (choice) => {
        const draft = get().openDraft;
        return draft
          ? autoSaver.resolveConflict(draft.identifier, choice)
          : Promise.resolve(success(undefined));
      },
      recoverNote: () => {
        const draft = get().openDraft;
        return draft
          ? autoSaver.recoverAsNewNote(draft.identifier)
          : Promise.resolve(success(undefined));
      },
      setClosing: (isClosing) => set({ isClosing }),
      pauseAutoSave: () => autoSaver.pause(),
      resumeAutoSave: () => autoSaver.resume(),
      createFolder: (name) => mutate(() => repository.createFolder(name)),
      renameNote: (path, name) =>
        mutate(
          () => repository.renameNote(path, name),
          (note) => {
            autoSaver.acceptRenamedNote(path, note);
            if (lastOpenedPath === path) void rememberNote(note.relativePath);
          },
        ),
      deleteNote: (path) =>
        mutate(
          () => repository.deleteNote(path),
          () => {
            autoSaver.forgetDeletedPath(path);
            if (lastOpenedPath === path) void rememberNote(null);
          },
        ),
      renameFolder: (path, name) =>
        mutate(
          () => repository.renameFolder(path, name),
          (folder) => {
            autoSaver.relocateFolder(path, folder.relativePath);
            if (lastOpenedPath && isInsideFolder(lastOpenedPath, path))
              void rememberNote(`${folder.relativePath}${lastOpenedPath.slice(path.length)}`);
            const selected = get().activeFolderPath;
            if (selected && isInsideFolder(selected, path))
              set({ activeFolderPath: `${folder.relativePath}${selected.slice(path.length)}` });
          },
        ),
      deleteFolder: (path) =>
        mutate(
          () => repository.deleteFolder(path),
          () => {
            autoSaver.forgetDeletedPath(path);
            if (lastOpenedPath && isInsideFolder(lastOpenedPath, path)) void rememberNote(null);
          },
        ),
    };
  });

  autoSaver.subscribe(({ draft, previousPath }) => {
    const state = store.getState();
    const isCurrent = state.openDraft?.identifier === draft.identifier;
    const existingNote = state.tree.notes.find(
      (note) => note.relativePath === draft.note.relativePath,
    );
    const summaryChanged =
      draft.isMissing ||
      previousPath !== draft.note.relativePath ||
      !existingNote ||
      existingNote.modifiedAt !== draft.note.modifiedAt ||
      existingNote.searchText !== draft.note.searchText;
    let tree = state.tree;
    if (summaryChanged) {
      const notes = tree.notes.filter(
        (note) =>
          note.relativePath !== previousPath && note.relativePath !== draft.note.relativePath,
      );
      if (!draft.isMissing) notes.push(draft.note);
      notes.sort(
        (first, second) =>
          second.modifiedAt - first.modifiedAt || first.title.localeCompare(second.title),
      );
      tree = { ...tree, notes };
    }
    store.setState({
      tree,
      ...(isCurrent ? { openDraft: draft } : {}),
      pendingDrafts: autoSaver.drafts().filter((session) => session.dirty),
    });
    if (isCurrent && previousPath !== draft.note.relativePath)
      void rememberNote(draft.note.relativePath);
  });
  return store;
}

export type WorkspaceStore = ReturnType<typeof createWorkspaceStore>;
