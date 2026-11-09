import { SearchIndex } from '@/features/search/SearchIndex';
import { IndexedNoteRepository } from '@/features/search/IndexedNoteRepository';
import { createStore } from 'zustand/vanilla';
import type { NoteRepository } from '@/features/storage/NoteRepository';
import {
  describeStorageError,
  failure,
  success,
  type RepositoryResult,
  type RepositoryError,
} from '@/features/storage/repository-result';
import { isInsideFolder } from '@/features/storage/storage-paths';
import { NoteAutoSaver } from '@/features/editor/NoteAutoSaver';
import type { WorkspaceOptions, WorkspaceState } from '@/store/workspace-state';
import { NoteLinkIndex, emptyLinkIndex } from '@/features/note-links/NoteLinkIndex';
import { LinkedNoteRepository } from '@/features/note-links/LinkedNoteRepository';
import { createNavigationHistory } from '@/store/navigation-history';
import { restoreLinkedNote } from '@/features/note-links/restore-linked-note';
import type { VaultTree } from '@/types/notes';
import { mergeHydratedTree } from './merge-hydrated-tree';
import { compareNoteRecency } from '@/features/storage/note-order';
import { validateSavedVaultPath } from '@/features/onboarding/vault-location';
import { ScanBudget } from '@/features/storage/ScanBudget';
import { defaultScanLimits } from '@/features/storage/ScanLimits';

export function createWorkspaceStore(
  sourceRepository: NoteRepository,
  options: WorkspaceOptions = {},
) {
  const navigation = createNavigationHistory();
  const linkIndex = new NoteLinkIndex((links) => store.setState({ links }));
  const searchIndex = new SearchIndex(
    () => store.setState((state) => ({ searchRevision: state.searchRevision + 1 })),
    (error) => store.setState({ error }),
  );
  const indexedRepository = new IndexedNoteRepository(sourceRepository, searchIndex);
  const repository = new LinkedNoteRepository(
    indexedRepository,
    linkIndex,
    (rename, notes) => {
      autoSaver.acceptLinkRename(rename, notes);
      navigation.getState().rename(rename);
    },
    (error) => store.setState({ error }),
  );
  const autoSaver = new NoteAutoSaver(repository);
  let initialization: Promise<void> | null = null;
  let active = true;
  let hasLoadedVault = false;
  let lastOpenedPath = options.lastOpenedNotePath ?? null;
  async function rememberNote(path: string | null) {
    lastOpenedPath = path;
    await options.rememberNote?.(path);
  }
  const store = createStore<WorkspaceState>()((set, get) => {
    let operationQueue: Promise<void> = Promise.resolve();
    let pendingOperations = 0;
    let refreshIdentifier = 0;

    function indexTree(tree: VaultTree, rebuildLinks: boolean) {
      void searchIndex
        .refresh(sourceRepository, tree.notes)
        .then((indexed) => {
          if (!indexed.ok && active) set({ error: indexed.error });
        })
        .catch((error: unknown) => {
          if (active) set({ error: describeStorageError(error, 'Could not update note search.') });
        });
      if (rebuildLinks)
        linkIndex.scheduleRebuild(sourceRepository, (error) => {
          if (active) set({ error });
        });
    }

    function reportHydrationError(error: RepositoryError) {
      searchIndex.cancel();
      if (!hasLoadedVault) linkIndex.cancel();
      const hasUnsavedDraft =
        get().openDraft?.dirty || get().pendingDrafts.some((draft) => draft.dirty);
      set((state) => ({
        error,
        isLoading: false,
        ...(!hasLoadedVault && !hasUnsavedDraft ? { vaultError: error } : {}),
        searchRevision: state.searchRevision + 1,
      }));
    }

    async function refreshTree(rebuildLinks = true) {
      if (get().vaultError)
        return failure(
          get().vaultError ?? { code: 'unavailable', message: 'Choose a folder again.' },
        );
      const requestIdentifier = ++refreshIdentifier;
      set({ isLoading: true });
      const limits = options.scanLimits ?? defaultScanLimits;
      const budget = new ScanBudget(limits);
      let result: RepositoryResult<VaultTree>;
      try {
        const valid =
          options.vaultPath !== undefined
            ? validateSavedVaultPath(options.vaultPath)
            : success(undefined);
        result = valid.ok ? await budget.wait(repository.listTree(limits)) : valid;
      } catch (error) {
        result = failure(describeStorageError(error, 'Could not open the notes folder.'));
      }
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
        else reportHydrationError(result.error);
      }
      if (result.ok && requestIdentifier === refreshIdentifier && active) {
        const hydration = sourceRepository.hydrateTree?.();
        if (!hydration) {
          hasLoadedVault = true;
          indexTree(result.value, rebuildLinks);
        } else {
          searchIndex.isRefreshing = true;
          void budget
            .wait(hydration)
            .then((hydrated) => {
              if (requestIdentifier !== refreshIdentifier || !active) return;
              if (hydrated.ok) {
                hasLoadedVault = true;
                const tree = mergeHydratedTree(result.value, get().tree, hydrated.value);
                set({ tree });
                indexTree(tree, rebuildLinks);
              } else {
                reportHydrationError(hydrated.error);
              }
            })
            .catch((error: unknown) => {
              if (requestIdentifier !== refreshIdentifier || !active) return;
              reportHydrationError(describeStorageError(error, 'Could not load note previews.'));
            });
        }
      }
      return result;
    }

    function enqueue<Value>(
      operation: () => Promise<RepositoryResult<Value>>,
    ): Promise<RepositoryResult<Value>> {
      const vaultError = get().vaultError;
      if (vaultError) return Promise.resolve(failure(vaultError));
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

    async function loadNote(path: string, rememberHistory = true): Promise<RepositoryResult<void>> {
      const previousIdentifier = get().openDraft?.identifier;
      const left = await leaveCurrentDraft();
      if (!left.ok) return left;
      set({ isOpeningNote: true, view: 'editor', openingError: null });
      const loaded = await autoSaver.load(path);
      if (!loaded.ok) set({ openDraft: null, isOpeningNote: false, openingError: loaded.error });
      else {
        set({ openDraft: loaded.value, isOpeningNote: false });
        await rememberNote(loaded.value.note.relativePath);
        if (rememberHistory) navigation.getState().visit(loaded.value.note.relativePath);
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
          await refreshTree(false);
        }
        return result;
      });
    }

    return {
      tree: { vaultPath: '', folders: [], notes: [] },
      links: emptyLinkIndex,
      navigation,
      activeFolderPath: null,
      searchText: '',
      searchIndex,
      searchRevision: 0,
      isSearchOpen: false,
      setSearchOpen: (isSearchOpen) => set({ isSearchOpen }),
      isLoading: true,
      isMutating: false,
      isClosing: false,
      error: null,
      vaultError: null,
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
      initialize: () => {
        initialization ??= (async () => {
          const startupBudget = new ScanBudget(options.scanLimits);
          const tree = await refreshTree(false);
          linkIndex.cancel();
          const indexing = tree.ok
            ? (sourceRepository.hydrateTree?.() ?? Promise.resolve(tree)).then((hydrated) =>
                hydrated.ok && active
                  ? linkIndex.rebuild(sourceRepository, get().tree.notes)
                  : hydrated.ok
                    ? success(undefined)
                    : hydrated,
              )
            : Promise.resolve(success(undefined));
          if (tree.ok && options.reopenLastNote !== false && options.lastOpenedNotePath)
            await get().openNote(options.lastOpenedNotePath);
          const indexed = await startupBudget
            .wait(indexing)
            .catch((error: unknown) =>
              failure(describeStorageError(error, 'Could not index note links.')),
            );
          if (!indexed.ok) reportHydrationError(indexed.error);
        })();
        return initialization;
      },
      openNote: (path) => enqueue(() => loadNote(path)),
      navigateHistory: (direction) =>
        enqueue(async () => {
          const history = navigation.getState();
          const path = history.paths[history.position + direction];
          if (!path) return success(undefined);
          const available = await repository.readNote(path);
          if (!available.ok) {
            set({ error: available.error });
            return available;
          }
          const result = await loadNote(path, false);
          if (result.ok) navigation.getState().move(direction);
          else set({ error: result.error });
          return result;
        }),
      createLinkedNote: (title, folder) =>
        enqueue(async () => {
          const result = await repository.createNote({ title, folder });
          if (!result.ok) set({ error: result.error });
          else await refreshTree(false);
          return result;
        }),
      restoreLinkedNote: (path) =>
        enqueue(async () => {
          const result = await restoreLinkedNote(repository, path);
          if (!result.ok) set({ error: result.error });
          else await refreshTree(false);
          return result;
        }),
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
            await refreshTree(false);
            await loadNote(result.value.relativePath);
          }
          return result;
        }),
      updateNoteContent: (identifier, content) => autoSaver.update(identifier, { content }),
      editNoteTitle: (identifier, title) => autoSaver.editTitle(identifier, title),
      commitNoteTitle: async (identifier, title) => {
        const result = await autoSaver.commitTitle(identifier, title);
        return result.ok ? success(autoSaver.get(identifier)?.note.title ?? title) : result;
      },
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
      pauseAutoSave: () => {
        active = false;
        autoSaver.pause();
        linkIndex.cancel();
        searchIndex.cancel();
      },
      resumeAutoSave: () => {
        active = true;
        autoSaver.resume();
      },
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
      notes.sort(compareNoteRecency);
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
