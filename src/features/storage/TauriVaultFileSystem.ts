import { isTauri } from '@tauri-apps/api/core';
import { join, resolve } from '@tauri-apps/api/path';
import {
  lstat,
  mkdir,
  readDir,
  readTextFile,
  remove,
  rename,
  writeTextFile,
  type FileInfo,
} from '@tauri-apps/plugin-fs';
import { describeStorageError, storageFailure } from '@/features/storage/repository-result';
import {
  assertInsideVault,
  joinRelativePath,
  pathName,
  validateRelativePath,
} from '@/features/storage/storage-paths';
import type {
  VaultEntry,
  VaultFileSystem,
  VaultMetadata,
} from '@/features/storage/VaultFileSystem';

const windowsReparsePointAttribute = 0x400;

function metadataFromFileInfo(fileInformation: FileInfo): VaultMetadata {
  return {
    type:
      fileInformation.isSymlink ||
      (fileInformation.fileAttributes !== null &&
        (fileInformation.fileAttributes & windowsReparsePointAttribute) !== 0) ||
      (!fileInformation.isFile && !fileInformation.isDirectory)
        ? 'link'
        : fileInformation.isDirectory
          ? 'directory'
          : 'file',
    modifiedAt: fileInformation.mtime?.getTime() ?? fileInformation.birthtime?.getTime() ?? 0,
  };
}

async function inspectPath(path: string): Promise<VaultMetadata | null> {
  try {
    return metadataFromFileInfo(await lstat(path));
  } catch (error) {
    if (describeStorageError(error, '').code === 'not-found') return null;
    throw error;
  }
}

export class TauriVaultFileSystem implements VaultFileSystem {
  private vaultPath = '';

  constructor(private readonly resolveVaultPath: () => Promise<string>) {}

  async initialize(): Promise<string> {
    if (!isTauri())
      storageFailure('unavailable', 'Open the Anehalo desktop app to access your local vault.');
    this.vaultPath = await resolve(await this.resolveVaultPath());
    const existing = await inspectPath(this.vaultPath);
    if (!existing) await mkdir(this.vaultPath, { recursive: true });
    const root = await inspectPath(this.vaultPath);
    if (root?.type !== 'directory')
      storageFailure(
        'invalid-path',
        'The Anehalo vault must be a real directory, not a link or file.',
      );
    return this.vaultPath;
  }

  private async absolutePath(relativePath: string): Promise<string> {
    validateRelativePath(relativePath, true, true);
    if (!this.vaultPath) storageFailure('unavailable', 'The vault is not initialized.');
    const absolutePath = relativePath
      ? await resolve(this.vaultPath, ...relativePath.split('/'))
      : this.vaultPath;
    assertInsideVault(this.vaultPath, absolutePath);
    let currentPath = '';
    const components = ['', ...relativePath.split('/').filter(Boolean)];
    for (const component of components) {
      currentPath = joinRelativePath(currentPath, component);
      const inspectedPath = currentPath
        ? await join(this.vaultPath, ...currentPath.split('/'))
        : this.vaultPath;
      const metadata = await inspectPath(inspectedPath);
      if (metadata?.type === 'link')
        storageFailure(
          'invalid-path',
          'Symbolic links and junctions are not supported inside the vault.',
        );
    }
    return absolutePath;
  }

  async metadata(relativePath: string): Promise<VaultMetadata | null> {
    return inspectPath(await this.absolutePath(relativePath));
  }

  async readDirectory(relativePath: string): Promise<readonly VaultEntry[]> {
    const entries = await readDir(await this.absolutePath(relativePath));
    const result: VaultEntry[] = [];
    for (const entry of entries) {
      if (entry.isSymlink) {
        result.push({ name: entry.name, type: 'link' });
        continue;
      }
      const absolute = await join(
        this.vaultPath,
        ...joinRelativePath(relativePath, entry.name).split('/'),
      );
      const metadata = await inspectPath(absolute);
      if (!metadata)
        storageFailure(
          'not-found',
          'The vault changed while it was being read. Reload and try again.',
        );
      result.push({ name: entry.name, type: metadata.type });
    }
    return result;
  }

  async readText(relativePath: string): Promise<string> {
    return readTextFile(await this.absolutePath(relativePath));
  }

  async writeText(relativePath: string, content: string): Promise<void> {
    await writeTextFile(await this.absolutePath(relativePath), content, { createNew: true });
  }

  async createDirectory(relativePath: string): Promise<void> {
    await mkdir(await this.absolutePath(relativePath));
  }

  async rename(source: string, destination: string): Promise<void> {
    const sourcePath = await this.absolutePath(source);
    const destinationPath = await this.absolutePath(destination);
    await rename(sourcePath, destinationPath);
  }

  async removeTemporaryFile(relativePath: string): Promise<void> {
    if (!/^\.anehalo-[\w-]+\.tmp$/.test(pathName(relativePath)))
      storageFailure('invalid-path', 'Only an internal temporary file may be removed permanently.');
    await remove(await this.absolutePath(relativePath));
  }
}
