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
import type { ThumbnailService } from '@/features/thumbnails/thumbnail-service';
import type { LinkRename } from '@/features/note-links/NoteLinkRewriter';
import { renderExportImage } from '@/features/thumbnails/thumbnail-renderer';
import { describeStorageError } from '@/features/storage/repository-result';
import { DiagramImportService } from '@/features/diagram-import/DiagramImportService';

type DiagramActions = Pick<
  WorkspaceState,
  | 'newDiagram'
  | 'openDiagramFile'
  | 'updateDiagram'
  | 'saveDiagram'
  | 'checkOpenDiagram'
  | 'resolveDiagramConflict'
  | 'trashDiagram'
  | 'createDiagramFile'
  | 'isDiagramInTrash'
  | 'restoreDiagram'
  | 'renderDiagramImage'
  | 'renameDiagram'
  | 'moveDiagram'
  | 'importDiagramFiles'
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
  /** Keeps cached thumbnails in step with renames, moves and trash; null without a cache. */
  readonly thumbnails: ThumbnailService | null;
  /** Updates links and embeds pointing at a renamed or trashed diagram (see LinkedNoteRepository). */
  readonly links: {
    rewrite: (rename: LinkRename) => Promise<unknown>;
    removed: (path: string) => void;
  };
  /** Keeps the shared diagram scan and search in step without reading the file again. */
  readonly content: {
    relocated: (previousPath: string, diagram: DiagramSummary) => void;
    trashed: (path: string) => void;
  };
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
  thumbnails,
  links,
  content,
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

  /**
   * Saves the open diagram before files change on disk: it may be the one being renamed, or it
   * may link to it and so be rewritten.
   */
  function saveOpenDiagram(autoSaver: DiagramAutoSaver) {
    return autoSaver.flush();
  }

  async function relocated(
    autoSaver: DiagramAutoSaver,
    path: string,
    result: RepositoryResult<DiagramSummary>,
  ) {
    if (result.ok) {
      autoSaver.relocate(path, result.value);
      content.relocated(path, result.value);
      history.rename(path, result.value.relativePath);
      await thumbnails?.moved(path, result.value.relativePath);
      await links.rewrite({ previousPath: path, nextPath: result.value.relativePath });
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
    createDiagramFile: (folder) =>
      withDiagrams((diagrams) =>
        enqueue(async () => {
          const created = await diagrams.createDiagram(folder);
          if (!created.ok) {
            logFailure('diagram-create-failed', created.error.code);
            return created;
          }
          await refreshTree();
          return created;
        }),
      ),
    isDiagramInTrash: (path) => withDiagrams((diagrams) => diagrams.isInTrash(path)),
    restoreDiagram: (path) =>
      withDiagrams((diagrams) =>
        enqueue(async () => {
          const restored = await diagrams.restoreDiagram(path);
          if (restored.ok) await refreshTree();
          return restored;
        }),
      ),
    renderDiagramImage: (path) =>
      withDiagrams(async (diagrams) => {
        const loaded = await diagrams.readDiagram(path);
        if (!loaded.ok) return loaded;
        try {
          const image = await renderExportImage(loaded.value.scene);
          if (image.state !== 'image')
            return failure({
              code: 'invalid-diagram',
              message:
                image.state === 'empty'
                  ? 'This diagram is empty.'
                  : 'This diagram could not be drawn.',
            });
          return success({
            name: `${loaded.value.summary.title}.png`,
            bytes: image.bytes,
            mimeType: image.mimeType,
          });
        } catch (error) {
          return failure(describeStorageError(error, 'This diagram could not be drawn.'));
        }
      }),
    importDiagramFiles: (candidates, folder, confirmLarge) =>
      withDiagrams(async (diagrams) => {
        const importer = new DiagramImportService({
          decode: (kind, bytes) => diagrams.decodeImport(kind, bytes),
          // One write at a time in the workspace queue, so a confirmation dialog between files
          // never holds the queue.
          write: (target, title, text) =>
            enqueue(() => diagrams.importDiagram(target, title, text)),
          confirmLarge,
        });
        const report = await importer.importFiles(candidates, folder);
        const [first] = report.imported;
        if (!first) return success(report);
        // The list refreshes once; the shared scan then reads the new files for links and search.
        await enqueue(async () => {
          await refreshTree();
          return success(undefined);
        });
        if (candidates.length === 1) await getState().openDiagramFile(first.relativePath);
        return success(report);
      }),
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
          await thumbnails?.removed(path);
          // Embeds and links stay in notes and show "in trash"; only the diagram's own links go.
          links.removed(path);
          content.trashed(path);
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
          const saved = await saveOpenDiagram(autoSaver);
          if (!saved.ok) return saved;
          return relocated(autoSaver, path, await diagrams.renameDiagram(path, title));
        }),
      ),
    moveDiagram: (path, folder) =>
      withDiagrams((diagrams, autoSaver) =>
        enqueue(async () => {
          const saved = await saveOpenDiagram(autoSaver);
          if (!saved.ok) return saved;
          return relocated(autoSaver, path, await diagrams.moveDiagram(path, folder));
        }),
      ),
  };
}
