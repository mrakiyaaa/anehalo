import type { DiagramAutoSaver } from '@/features/diagrams/DiagramAutoSaver';
import type { DiagramRepository } from '@/features/diagrams/DiagramRepository';
import {
  failure,
  success,
  type RepositoryError,
  type RepositoryResult,
} from '@/features/storage/repository-result';
import type { DiagramSummary, VaultTree } from '@/types/notes';
import type { WorkspaceState } from '@/store/workspace-state';
import { logFailure } from '@/features/diagnostics/error-logging';

type DiagramActions = Pick<
  WorkspaceState,
  | 'newDiagram'
  | 'openDiagramFile'
  | 'updateDiagram'
  | 'saveDiagram'
  | 'checkOpenDiagram'
  | 'resolveDiagramConflict'
  | 'trashDiagram'
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
  /** Saves and closes the open note, as before any other item opens. */
  readonly leaveNote: () => Promise<RepositoryResult<void>>;
  /** The back/forward history shared with notes. */
  readonly history: {
    visit: (path: string) => void;
    rename: (previousPath: string, nextPath: string) => void;
  };
}

const unavailable: RepositoryError = {
  code: 'unavailable',
  message: 'Diagrams are not available for this notes folder.',
};
const missing: RepositoryError = {
  code: 'not-found',
  message: 'This diagram was deleted or renamed outside Anehalo.',
};

export interface DiagramNavigation {
  /**
   * Opens a diagram for back/forward: the history is left as it is, and the current item stays
   * open if the file is gone.
   */
  readonly revisitDiagram: (path: string) => Promise<RepositoryResult<void>>;
}

/** Diagram actions for the workspace store; diagrams save through their own auto-saver. */
export function createDiagramActions({
  repository,
  saver,
  enqueue,
  refreshTree,
  getState,
  setState,
  leaveNote,
  history,
}: DiagramActionContext): DiagramActions & DiagramNavigation {
  function withDiagrams<Value>(
    operation: (
      diagrams: DiagramRepository,
      autoSaver: DiagramAutoSaver,
    ) => Promise<RepositoryResult<Value>>,
  ): Promise<RepositoryResult<Value>> {
    if (!repository || !saver) return Promise.resolve(failure(unavailable));
    return operation(repository, saver);
  }

  function reportFailure<Value>(result: RepositoryResult<Value>): RepositoryResult<Value> {
    if (!result.ok) setState({ error: result.error });
    return result;
  }

  async function open(
    diagrams: DiagramRepository,
    autoSaver: DiagramAutoSaver,
    path: string,
    rememberHistory: boolean,
  ): Promise<RepositoryResult<void>> {
    const left = await leaveNote();
    if (!left.ok) return left;
    setState({ view: 'diagram', isOpeningDiagram: true, diagramOpenError: null });
    const loaded = await diagrams.readDiagram(path);
    // An unreadable file never gets a session, so nothing can ever be saved over it.
    if (!loaded.ok) {
      setState({ isOpeningDiagram: false, diagramOpenError: loaded.error });
      return loaded;
    }
    const opened = await autoSaver.open(loaded.value);
    setState({ isOpeningDiagram: false, diagramOpenError: opened.ok ? null : opened.error });
    if (!opened.ok) return opened;
    if (rememberHistory) history.visit(path);
    return success(undefined);
  }

  /** Saves the open diagram first when it is the one about to change on disk. */
  async function saveIfOpen(autoSaver: DiagramAutoSaver, path: string) {
    return path === autoSaver.draft?.summary.relativePath ? autoSaver.flush() : success(undefined);
  }

  async function relocated(
    autoSaver: DiagramAutoSaver,
    path: string,
    result: RepositoryResult<DiagramSummary>,
  ) {
    if (result.ok) {
      autoSaver.relocate(path, result.value);
      history.rename(path, result.value.relativePath);
    } else logFailure('diagram-rename-failed', result.error.code);
    await refreshTree();
    return result;
  }

  return {
    revisitDiagram: (path) =>
      withDiagrams(async (diagrams, autoSaver) => {
        const modifiedAt = await diagrams.diagramModifiedAt(path);
        if (!modifiedAt.ok) return reportFailure(modifiedAt);
        if (modifiedAt.value === null) return reportFailure(failure(missing));
        return open(diagrams, autoSaver, path, false);
      }),
    newDiagram: (folder) =>
      withDiagrams((diagrams, autoSaver) =>
        enqueue(async () => {
          const created = await diagrams.createDiagram(
            folder === undefined ? getState().activeFolderPath : folder,
          );
          if (!created.ok) {
            logFailure('diagram-create-failed', created.error.code);
            return reportFailure(created);
          }
          await refreshTree();
          return open(diagrams, autoSaver, created.value.relativePath, true);
        }),
      ),
    openDiagramFile: (path) =>
      withDiagrams((diagrams, autoSaver) => enqueue(() => open(diagrams, autoSaver, path, true))),
    updateDiagram: (scene) => saver?.update(scene),
    saveDiagram: () => withDiagrams((_diagrams, autoSaver) => autoSaver.flush()),
    checkOpenDiagram: () => (saver ? saver.checkExternal() : Promise.resolve(success(undefined))),
    resolveDiagramConflict: (choice) =>
      withDiagrams((_diagrams, autoSaver) => autoSaver.resolveConflict(choice)),
    trashDiagram: (path) =>
      withDiagrams((diagrams, autoSaver) =>
        enqueue(async () => {
          const trashed = await diagrams.trashDiagram(path);
          if (!trashed.ok) return trashed;
          if (autoSaver.draft?.summary.relativePath === path) {
            autoSaver.forget(path);
            if (getState().view === 'diagram') setState({ view: 'home' });
          }
          await refreshTree();
          return trashed;
        }),
      ),
    renameDiagram: (path, title) =>
      withDiagrams((diagrams, autoSaver) =>
        enqueue(async () => {
          const saved = await saveIfOpen(autoSaver, path);
          if (!saved.ok) return saved;
          return relocated(autoSaver, path, await diagrams.renameDiagram(path, title));
        }),
      ),
    moveDiagram: (path, folder) =>
      withDiagrams((diagrams, autoSaver) =>
        enqueue(async () => {
          const saved = await saveIfOpen(autoSaver, path);
          if (!saved.ok) return saved;
          return relocated(autoSaver, path, await diagrams.moveDiagram(path, folder));
        }),
      ),
  };
}
