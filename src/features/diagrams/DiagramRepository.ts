import './excalidraw-environment';
import { logFailure } from '@/features/diagnostics/error-logging';
import type { TrashEntry } from '@/features/storage/NoteRepository';
import { DEFAULT_DIAGRAM_TITLE, diagramTitle } from '@/features/storage/note-names';
import {
  StorageFailure,
  describeStorageError,
  failure,
  storageFailure,
  type RepositoryError,
  type RepositoryResult,
} from '@/features/storage/repository-result';
import { validateRelativePath } from '@/features/storage/storage-paths';
import { DIAGRAM_EXTENSION, diagramSummary, itemKind } from '@/features/storage/vault-items';
import type { VaultStorage } from '@/features/storage/vault-storage';
import type { DiagramSummary } from '@/types/notes';
import type { DiagramScene } from './diagram-codec';
import { DiagramWriteError } from './diagram-errors';

type DiagramCodec = typeof import('./diagram-codec');

export const DIAGRAM_SAVE_MEASURE = 'anehalo:diagram-save';

export interface LoadedDiagram {
  readonly summary: DiagramSummary;
  readonly scene: DiagramScene;
  /** The file exactly as read, to tell a real outside change from a touched timestamp. */
  readonly text: string;
}

export interface SavedDiagram {
  readonly summary: DiagramSummary;
  readonly text: string;
}

/**
 * Reads and writes .excalidraw files in the vault. It shares the vault's operation queue and
 * file helpers with notes. Excalidraw itself (in diagram-codec) is loaded only when a diagram's
 * content is read or written, never for listing, renaming, moving or trashing.
 */
export class DiagramRepository {
  constructor(
    private readonly storage: VaultStorage,
    private readonly loadCodec: () => Promise<DiagramCodec> = () => import('./diagram-codec'),
  ) {}

  private get files() {
    return this.storage.files;
  }

  private validate(path: string): string {
    validateRelativePath(path);
    if (itemKind(path) !== 'diagram')
      storageFailure('invalid-path', `Diagrams must have a ${DIAGRAM_EXTENSION} extension.`);
    return path;
  }

  private async summary(path: string): Promise<DiagramSummary> {
    const metadata = await this.files.requireEntry(path, 'file');
    return diagramSummary(path, metadata.modifiedAt);
  }

  createDiagram(
    folder: string | null = null,
    name: string = DEFAULT_DIAGRAM_TITLE,
  ): Promise<RepositoryResult<DiagramSummary>> {
    return this.storage.operations.run('Could not create the diagram.', async () => {
      const { emptyDiagramText } = await this.loadCodec();
      const path = await this.files.createUniqueFile(
        validateRelativePath(folder ?? '', true),
        diagramTitle(name),
        DIAGRAM_EXTENSION,
        emptyDiagramText(),
      );
      return this.summary(path);
    });
  }

  async readDiagram(relativePath: string): Promise<RepositoryResult<LoadedDiagram>> {
    const result = await this.storage.operations.run('This diagram can’t be opened.', async () => {
      const path = this.validate(relativePath);
      const summary = await this.summary(path);
      const text = await this.files.fileSystem.readText(path);
      const { parseDiagram } = await this.loadCodec();
      return { summary, scene: parseDiagram(text), text };
    });
    if (!result.ok) logFailure('diagram-load-failed', result.error.code);
    return result;
  }

  /** Just the file's modified time, so outside changes can be noticed without reading it. */
  diagramModifiedAt(relativePath: string): Promise<RepositoryResult<number | null>> {
    return this.storage.operations.run('Could not check the diagram.', async () => {
      const metadata = await this.files.fileSystem.metadata(this.validate(relativePath));
      return metadata?.type === 'file' ? metadata.modifiedAt : null;
    });
  }

  async writeDiagram(
    relativePath: string,
    scene: DiagramScene,
  ): Promise<RepositoryResult<SavedDiagram>> {
    const started = performance.now();
    let text: string;
    try {
      // Serializing a large drawing yields between steps, so it runs before taking the queue.
      text = await (await this.loadCodec()).serializeDiagram(scene);
    } catch (error) {
      return this.saveFailed(describeStorageError(error, 'Could not prepare the diagram.'));
    }
    const result = await this.storage.operations.run('Could not save the diagram.', async () => {
      const path = this.validate(relativePath);
      await this.files.requireEntry(path, 'file');
      try {
        await this.files.atomicWrite(path, text);
      } catch (error) {
        throw new DiagramWriteError(
          error instanceof StorageFailure
            ? error.storageError
            : describeStorageError(error, 'Could not write the file.'),
        );
      }
      return { summary: await this.summary(path), text };
    });
    if (!result.ok) return this.saveFailed(result.error);
    // Lets diagnostics and the E2E performance test read how long each save took.
    performance.measure(DIAGRAM_SAVE_MEASURE, { start: started });
    return result;
  }

  private saveFailed(error: RepositoryError): RepositoryResult<never> {
    logFailure('diagram-save-failed', error.code);
    return failure(error);
  }

  renameDiagram(relativePath: string, title: string): Promise<RepositoryResult<DiagramSummary>> {
    return this.storage.operations.run('Could not rename the diagram.', async () => {
      const destination = await this.files.renameFile(
        this.validate(relativePath),
        diagramTitle(title),
        DIAGRAM_EXTENSION,
        true,
      );
      return this.summary(destination);
    });
  }

  moveDiagram(
    relativePath: string,
    folder: string | null,
  ): Promise<RepositoryResult<DiagramSummary>> {
    return this.storage.operations.run('Could not move the diagram.', async () => {
      const source = this.validate(relativePath);
      const destination = await this.files.moveFile(
        source,
        validateRelativePath(folder ?? '', true),
        diagramSummary(source, 0).title,
        DIAGRAM_EXTENSION,
      );
      return this.summary(destination);
    });
  }

  trashDiagram(relativePath: string): Promise<RepositoryResult<TrashEntry>> {
    return this.storage.operations.run('Could not move the diagram to trash.', async () => {
      const path = this.validate(relativePath);
      await this.files.requireEntry(path, 'file');
      return this.files.moveToTrash(path);
    });
  }
}
