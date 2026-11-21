import { isTauri, invoke } from '@tauri-apps/api/core';
import { join, resolve } from '@tauri-apps/api/path';
import {
  lstat,
  mkdir,
  readDir,
  readTextFile,
  readFile,
  remove,
  rename,
  writeTextFile,
  writeFile,
  type FileInfo,
} from '@tauri-apps/plugin-fs';
import {
  describeStorageError,
  failure,
  StorageFailure,
  storageFailure,
  success,
  type RepositoryResult,
} from '@/features/storage/repository-result';
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
import { ScanBudget, defaultScanScheduling } from './ScanBudget';

const windowsReparsePointAttribute = 0x400;

/**
 * Files larger than this go to disk in pieces, yielding between them: encoding and passing a
 * diagram with large images in one call would freeze the window for a noticeable moment.
 */
export const WRITE_CHUNK_CHARACTERS = 1024 * 1024;

/** Splits text into pieces of at most the given length without cutting a character in two. */
export function textChunks(content: string, chunkLength = WRITE_CHUNK_CHARACTERS): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < content.length || chunks.length === 0) {
    let end = Math.min(start + chunkLength, content.length);
    const lastCode = content.charCodeAt(end - 1);
    if (end < content.length && lastCode >= 0xd800 && lastCode <= 0xdbff) end -= 1;
    chunks.push(content.slice(start, end));
    start = end;
  }
  return chunks;
}

/**
 * Content one `read_vault_files` call reads before it stops: decoding the reply runs on the
 * window's thread, so a batch stays small enough to never be a long task.
 */
export const READ_BATCH_BYTES = 2 * 1024 * 1024;

const utf8 = new TextDecoder();

/** Splits a `read_vault_files` reply: per file, `[status: u8][length: u32 LE][payload]`. */
export function decodeVaultReads(reply: ArrayBuffer): RepositoryResult<string>[] {
  const view = new DataView(reply);
  const results: RepositoryResult<string>[] = [];
  let offset = 0;
  while (offset < reply.byteLength) {
    const status = view.getUint8(offset);
    const length = view.getUint32(offset + 1, true);
    const payload = new Uint8Array(reply, offset + 5, length);
    offset += 5 + length;
    results.push(
      status === 0
        ? success(utf8.decode(payload))
        : failure(describeStorageError(JSON.parse(utf8.decode(payload)) as unknown, '')),
    );
  }
  return results;
}

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
    size: fileInformation.size,
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

/**
 * How text is read. A vault uses one native `read_vault_files` call per batch; the settings
 * folder lies outside any vault (in AppData, which a vault may never be), so it reads through
 * the file-system plugin, checking each path component from here.
 */
export type TextReads = 'vault-command' | 'file-system-plugin';

export class TauriVaultFileSystem implements VaultFileSystem {
  private vaultPath = '';

  constructor(
    private readonly resolveVaultPath: () => Promise<string>,
    private readonly createMissingRoot = true,
    private readonly textReads: TextReads = 'vault-command',
  ) {}

  async initialize(): Promise<string> {
    if (!isTauri())
      storageFailure('unavailable', 'Open the Anehalo desktop app to access your local vault.');
    this.vaultPath = await resolve(await this.resolveVaultPath());
    const existing = await inspectPath(this.vaultPath);
    if (!existing) {
      if (!this.createMissingRoot)
        storageFailure(
          'not-found',
          'The notes folder no longer exists. Restore it or choose another folder.',
        );
      await mkdir(this.vaultPath, { recursive: true });
    }
    const root = existing ?? (await inspectPath(this.vaultPath));
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

  async readDirectory(
    relativePath: string,
    maximumEntries?: number,
  ): Promise<readonly VaultEntry[]> {
    if (maximumEntries !== undefined) {
      await this.absolutePath(relativePath);
      return new ScanBudget().wait(
        invoke<readonly VaultEntry[]>('read_vault_directory', {
          vaultPath: this.vaultPath,
          relativePath,
          maximumEntries,
        }),
      );
    }
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
    if (this.textReads === 'file-system-plugin')
      return readTextFile(await this.absolutePath(relativePath));
    const [read] = await this.readTexts([relativePath]);
    if (!read) storageFailure('io-error', 'The file could not be read.');
    if (!read.ok) throw new StorageFailure(read.error);
    return read.value;
  }

  /** Rust checks each path as `absolutePath` does, next to the read, in one IPC round trip. */
  async readTexts(relativePaths: readonly string[]): Promise<readonly RepositoryResult<string>[]> {
    if (this.textReads === 'file-system-plugin')
      return Promise.all(
        relativePaths.map(async (relativePath) => {
          try {
            return success(await this.readText(relativePath));
          } catch (error) {
            return failure(describeStorageError(error, ''));
          }
        }),
      );
    for (const relativePath of relativePaths) validateRelativePath(relativePath, false, true);
    if (!this.vaultPath) storageFailure('unavailable', 'The vault is not initialized.');
    const reply = await invoke<ArrayBuffer>('read_vault_files', {
      vaultPath: this.vaultPath,
      relativePaths,
      maximumBytes: READ_BATCH_BYTES,
    });
    return decodeVaultReads(reply);
  }

  async readBytes(relativePath: string): Promise<Uint8Array> {
    return readFile(await this.absolutePath(relativePath));
  }

  async writeText(relativePath: string, content: string): Promise<void> {
    const path = await this.absolutePath(relativePath);
    const [first = '', ...rest] = textChunks(content);
    await writeTextFile(path, first, { createNew: true });
    for (const chunk of rest) {
      await defaultScanScheduling.yieldToInput();
      await writeTextFile(path, chunk, { append: true });
    }
  }

  async writeBytes(relativePath: string, content: Uint8Array): Promise<void> {
    await writeFile(await this.absolutePath(relativePath), content, { createNew: true });
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
