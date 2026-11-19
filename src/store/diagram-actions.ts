import type { DiagramAutoSaver } from '@/features/diagrams/DiagramAutoSaver';
import type { DiagramRepository } from '@/features/diagrams/DiagramRepository';
import {
  failure,
  success,
  type RepositoryError,
  type RepositoryResult,
} from '@/features/storage/repository-result';
import type { VaultTree } from '@/types/notes';
import type { WorkspaceState } from '@/store/workspace-state';

type DiagramActions = Pick<
  WorkspaceState,
  | 'newDiagram'
  | 'openDiagramFile'
  | 'updateDiagram'
  | 'saveDiagram'
  | 'checkOpenDiagram'
  | 'resolveDiagramConflict'
  | 'trashOpenDiagram'
  | 'renameDiagram'
  | 'moveDiagram'
>;

interface DiagramActionContext {
  readonly repository: DiagramRepository | null;
  readonly saver: DiagramAutoSaver | null;
  readonly enqueue: <Value>(
    operation: () => Promise<RepositoryResult<Value>>,
  ) => Promise<RepositoryResult<Value>>;
  readonly refreshTree: () => Promise<RepositoryResult<VaultTree>>;
  readonly getState: () => WorkspaceState;
  readonly setState: (state: Partial<WorkspaceState>) => void;
}

const unavailable: RepositoryError = {
  code: 'unavailable',
  message: 'Diagrams are not available for this notes folder.',
};

/** Diagram actions for the workspace store; diagrams save through their own auto-saver. */
export function createDiagramActions({
  repository,
  saver,
  enqueue,
  refreshTree,
  getState,
  setState,
}: DiagramActionContext): DiagramActions {
  function withDiagrams<Value>(
    operation: (
      diagrams: DiagramRepository,
      autoSaver: DiagramAutoSaver,
    ) => Promise<RepositoryResult<Value>>,
  ): Promise<RepositoryResult<Value>> {
    if (!repository || !saver) return Promise.resolve(failure(unavailable));
    return operation(repository, saver);
  }

  async function open(
    diagrams: DiagramRepository,
    autoSaver: DiagramAutoSaver,
    path: string,
  ): Promise<RepositoryResult<void>> {
    const loaded = await diagrams.readDiagram(path);
    // An unreadable file never gets a session, so nothing can ever be saved over it.
    if (!loaded.ok) {
      setState({ diagramOpenError: loaded.error });
      return loaded;
    }
    const opened = await autoSaver.open(loaded.value);
    setState({ diagramOpenError: opened.ok ? null : opened.error });
    return opened.ok ? success(undefined) : opened;
  }

  return {
    newDiagram: () =>
      withDiagrams((diagrams, autoSaver) =>
        enqueue(async () => {
          const created = await diagrams.createDiagram(getState().activeFolderPath);
          if (!created.ok) return created;
          await refreshTree();
          return open(diagrams, autoSaver, created.value.relativePath);
        }),
      ),
    openDiagramFile: (path) =>
      withDiagrams((diagrams, autoSaver) => enqueue(() => open(diagrams, autoSaver, path))),
    updateDiagram: (scene) => saver?.update(scene),
    saveDiagram: () => withDiagrams((_diagrams, autoSaver) => autoSaver.flush()),
    checkOpenDiagram: () => (saver ? saver.checkExternal() : Promise.resolve(success(undefined))),
    resolveDiagramConflict: (choice) =>
      withDiagrams((_diagrams, autoSaver) => autoSaver.resolveConflict(choice)),
    trashOpenDiagram: () =>
      withDiagrams((diagrams, autoSaver) =>
        enqueue(async () => {
          const path = autoSaver.draft?.summary.relativePath;
          if (!path) return failure({ code: 'not-found', message: 'No diagram is open.' });
          const trashed = await diagrams.trashDiagram(path);
          if (!trashed.ok) return trashed;
          autoSaver.forget(path);
          await refreshTree();
          return trashed;
        }),
      ),
    renameDiagram: (path, title) =>
      withDiagrams((diagrams, autoSaver) =>
        enqueue(async () => {
          const saved =
            path === autoSaver.draft?.summary.relativePath
              ? await autoSaver.flush()
              : success(undefined);
          if (!saved.ok) return saved;
          const renamed = await diagrams.renameDiagram(path, title);
          if (renamed.ok) autoSaver.relocate(path, renamed.value);
          await refreshTree();
          return renamed;
        }),
      ),
    moveDiagram: (path, folder) =>
      withDiagrams((diagrams, autoSaver) =>
        enqueue(async () => {
          const saved =
            path === autoSaver.draft?.summary.relativePath
              ? await autoSaver.flush()
              : success(undefined);
          if (!saved.ok) return saved;
          const moved = await diagrams.moveDiagram(path, folder);
          if (moved.ok) autoSaver.relocate(path, moved.value);
          await refreshTree();
          return moved;
        }),
      ),
  };
}
