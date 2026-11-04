import {
  StorageFailure,
  describeStorageError,
  storageFailure,
} from '@/features/storage/repository-result';
import { joinRelativePath, parentPath, pathName } from '@/features/storage/storage-paths';
import type { VaultFileSystem } from '@/features/storage/VaultFileSystem';
import type { TrashEntry } from '@/features/storage/NoteRepository';

export class VaultFileService {
  constructor(readonly fileSystem: VaultFileSystem) {}

  async requireEntry(path: string, type: 'file' | 'directory') {
    const metadata = await this.fileSystem.metadata(path);
    if (!metadata) storageFailure('not-found', 'The file or folder no longer exists.');
    if (metadata.type !== type)
      storageFailure(
        'invalid-type',
        'The path is not a supported file or folder. Links are not supported.',
      );
    return metadata;
  }

  async atomicWrite(path: string, content: string, overwrite = true): Promise<void> {
    const temporaryPath = joinRelativePath(parentPath(path), `.anehalo-${crypto.randomUUID()}.tmp`);
    try {
      await this.fileSystem.writeText(temporaryPath, content);
      if (!overwrite && (await this.fileSystem.metadata(path)))
        storageFailure(
          'already-exists',
          'The destination appeared while saving. Please try again.',
        );
      await this.fileSystem.rename(temporaryPath, path);
    } catch (error) {
      try {
        if (await this.fileSystem.metadata(temporaryPath))
          await this.fileSystem.removeTemporaryFile(temporaryPath);
      } catch (cleanupError) {
        const original = describeStorageError(error, 'Could not save the file.');
        const cleanup = describeStorageError(cleanupError, 'Could not remove the temporary file.');
        throw new StorageFailure({
          ...original,
          message: `${original.message} ${cleanup.message}`,
          detail: `${original.detail ?? original.message}\n${cleanup.detail ?? cleanup.message}`,
        });
      }
      throw error;
    }
  }

  async ensureDirectory(path: string): Promise<void> {
    let currentPath = '';
    for (const component of path.split('/')) {
      currentPath = joinRelativePath(currentPath, component);
      const existing = await this.fileSystem.metadata(currentPath);
      if (existing) await this.requireEntry(currentPath, 'directory');
      else await this.fileSystem.createDirectory(currentPath);
    }
  }

  async ensureDestinationAvailable(source: string, destination: string): Promise<void> {
    const entries = await this.fileSystem.readDirectory(parentPath(destination));
    const occupied = entries.find(
      (entry) => entry.name.toLowerCase() === pathName(destination).toLowerCase(),
    );
    if (occupied && occupied.name !== pathName(source))
      storageFailure('already-exists', 'A file or folder with that name exists.');
  }

  async moveToTrash(path: string): Promise<TrashEntry> {
    const deletedAt = Date.now();
    const entryDirectory = `.trash/${new Date(deletedAt).toISOString().replaceAll(':', '-')}-${crypto.randomUUID()}`;
    const trashPath = `${entryDirectory}/${path}`;
    await this.ensureDirectory(parentPath(trashPath));
    await this.fileSystem.rename(path, trashPath);
    return { originalPath: path, trashPath, deletedAt };
  }
}
