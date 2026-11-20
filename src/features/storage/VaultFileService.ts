import {
  StorageFailure,
  describeStorageError,
  storageFailure,
} from '@/features/storage/repository-result';
import { joinRelativePath, parentPath, pathName } from '@/features/storage/storage-paths';
import type { VaultFileSystem } from '@/features/storage/VaultFileSystem';
import type { TrashEntry } from '@/features/storage/NoteRepository';
import { uniqueName } from '@/features/storage/note-names';

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

  private async namesIn(folder: string, except?: string): Promise<string[]> {
    return (await this.fileSystem.readDirectory(folder))
      .map((entry) => entry.name)
      .filter((name) => except === undefined || name.toLowerCase() !== except.toLowerCase());
  }

  /** Creates a file whose name gets " 2", " 3"… when the title is already taken in the folder. */
  async createUniqueFile(
    folder: string,
    title: string,
    extension: string,
    content: string,
  ): Promise<string> {
    await this.requireEntry(folder, 'directory');
    const name = uniqueName(title, extension, await this.namesIn(folder));
    const path = joinRelativePath(folder, name);
    await this.atomicWrite(path, content, false);
    return path;
  }

  /** Renames a file in place; with suffixDuplicates, a taken title gets a number instead of failing. */
  async renameFile(
    source: string,
    title: string,
    extension: string,
    suffixDuplicates: boolean,
  ): Promise<string> {
    await this.requireEntry(source, 'file');
    const folder = parentPath(source);
    const name = suffixDuplicates
      ? uniqueName(title, extension, await this.namesIn(folder, pathName(source)))
      : `${title}${extension}`;
    const destination = joinRelativePath(folder, name);
    await this.ensureDestinationAvailable(source, destination);
    if (source !== destination) await this.fileSystem.rename(source, destination);
    return destination;
  }

  /** Moves a file into another folder, numbering its name if that folder already has one. */
  async moveFile(source: string, folder: string, title: string, extension: string) {
    await this.requireEntry(source, 'file');
    await this.requireEntry(folder, 'directory');
    if (parentPath(source) === folder) return source;
    const destination = joinRelativePath(
      folder,
      uniqueName(title, extension, await this.namesIn(folder)),
    );
    await this.fileSystem.rename(source, destination);
    return destination;
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
