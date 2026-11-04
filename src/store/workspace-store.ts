import { createStore } from 'zustand/vanilla';
import type { NoteRepository } from '@/features/storage/NoteRepository';
import {
  describeStorageError,
  failure,
  type RepositoryResult,
} from '@/features/storage/repository-result';
import { isInsideFolder } from '@/features/storage/storage-paths';
import { emptyCapture, persistCapture } from '@/store/capture-state';
import type { WorkspaceState } from '@/store/workspace-state';

export function createWorkspaceStore(repository: NoteRepository) {
  return createStore<WorkspaceState>()((set, get) => {
    let mutationQueue: Promise<void> = Promise.resolve();
    let pendingMutations = 0;
    let refreshIdentifier = 0;

    async function refreshTree() {
      const requestIdentifier = ++refreshIdentifier;
      set({ isLoading: true });
      const result = await repository.listTree();
      if (requestIdentifier === refreshIdentifier) {
        if (result.ok) {
          const selectedFolder = get().activeFolderPath;
          set({
            tree: result.value,
            isLoading: false,
            activeFolderPath: result.value.folders.some(
              (folder) => folder.relativePath === selectedFolder,
            )
              ? selectedFolder
              : null,
          });
        } else set({ error: result.error, isLoading: false });
      }
      return result;
    }

    function enqueue<Value>(
      operation: () => Promise<RepositoryResult<Value>>,
    ): Promise<RepositoryResult<Value>> {
      pendingMutations += 1;
      set({ isMutating: true, error: null });
      const task = mutationQueue.then(async () => {
        try {
          return await operation();
        } catch (error) {
          const result = failure(describeStorageError(error, 'Could not complete the change.'));
          if (!result.ok) set({ error: result.error });
          return result;
        } finally {
          pendingMutations -= 1;
          set({ isMutating: pendingMutations > 0 });
        }
      });
      mutationQueue = task.then(() => undefined);
      return task;
    }

    async function flushCapture() {
      const result = await persistCapture(repository, get().capture);
      if (!result.ok)
        set({
          error: result.error,
          capture: { ...get().capture, status: 'error', error: result.error },
        });
      else if (result.value) {
        const current = get().capture;
        set({
          capture: {
            ...current,
            relativePath: result.value.relativePath,
            folder: result.value.folder,
            savedContent: result.value.content,
            status: current.draft === result.value.content ? 'saved' : 'saving',
            error: null,
          },
        });
        await refreshTree();
      }
      return result;
    }

    function mutate<Value>(
      operation: () => Promise<RepositoryResult<Value>>,
      afterSuccess?: (value: Value) => void,
    ) {
      return enqueue(async () => {
        const captureResult = await flushCapture();
        if (!captureResult.ok) return captureResult;
        const result = await operation();
        if (!result.ok) set({ error: result.error });
        else {
          afterSuccess?.(result.value);
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
      isCreatingNote: false,
      error: null,
      capture: emptyCapture(),
      selectFolder: (activeFolderPath) => set({ activeFolderPath }),
      setSearchText: (searchText) => set({ searchText }),
      dismissError: () => set({ error: null }),
      reportError: (error) => set({ error }),
      refreshTree,
      updateCaptureDraft: (draft) => {
        const capture = get().capture;
        set({
          capture: {
            ...capture,
            draft,
            folder:
              !capture.relativePath && !capture.draft ? get().activeFolderPath : capture.folder,
            status:
              !capture.relativePath && !draft.trim()
                ? 'idle'
                : draft === capture.savedContent
                  ? capture.relativePath
                    ? 'saved'
                    : 'idle'
                  : 'saving',
            error: null,
          },
        });
      },
      saveCapture: () => enqueue(flushCapture),
      startQuickNote: () =>
        enqueue(async () => {
          set({ isCreatingNote: true });
          try {
            const previousCapture = await flushCapture();
            if (!previousCapture.ok) return previousCapture;
            const result = await repository.createNote({ folder: get().activeFolderPath });
            if (!result.ok) set({ error: result.error });
            else {
              set({
                capture: {
                  ...emptyCapture(),
                  relativePath: result.value.relativePath,
                  folder: result.value.folder,
                  status: 'saved',
                },
              });
              await refreshTree();
            }
            return result;
          } finally {
            set({ isCreatingNote: false });
          }
        }),
      createFolder: (name) => mutate(() => repository.createFolder(name)),
      renameNote: (path, name) =>
        mutate(
          () => repository.renameNote(path, name),
          (note) => {
            if (get().capture.relativePath === path)
              set({ capture: { ...get().capture, relativePath: note.relativePath } });
          },
        ),
      deleteNote: (path) =>
        mutate(
          () => repository.deleteNote(path),
          () => {
            if (get().capture.relativePath === path) set({ capture: emptyCapture() });
          },
        ),
      renameFolder: (path, name) =>
        mutate(
          () => repository.renameFolder(path, name),
          (folder) => {
            const replacePath = (current: string | null) =>
              current && isInsideFolder(current, path)
                ? `${folder.relativePath}${current.slice(path.length)}`
                : current;
            const capture = get().capture;
            set({
              activeFolderPath: replacePath(get().activeFolderPath),
              capture: {
                ...capture,
                relativePath: replacePath(capture.relativePath),
                folder: replacePath(capture.folder),
              },
            });
          },
        ),
      deleteFolder: (path) =>
        mutate(
          () => repository.deleteFolder(path),
          () => {
            const capture = get().capture;
            if (capture.relativePath && isInsideFolder(capture.relativePath, path))
              set({ capture: emptyCapture() });
          },
        ),
    };
  });
}

export type WorkspaceStore = ReturnType<typeof createWorkspaceStore>;
