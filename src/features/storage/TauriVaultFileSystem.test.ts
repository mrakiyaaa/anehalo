import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isTauri } from '@tauri-apps/api/core';
import {
  lstat,
  mkdir,
  readDir,
  readTextFile,
  readFile,
  writeFile,
  writeTextFile,
  rename,
  remove,
} from '@tauri-apps/plugin-fs';
import { TauriVaultFileSystem } from './TauriVaultFileSystem';

vi.mock('@tauri-apps/api/core', () => ({ isTauri: vi.fn(() => true) }));
vi.mock('@tauri-apps/api/path', () => ({
  resolve: (...parts: string[]) => Promise.resolve(parts.join('/')),
  join: (...parts: string[]) => Promise.resolve(parts.join('/')),
}));
vi.mock('@tauri-apps/plugin-fs', () => ({
  lstat: vi.fn(),
  mkdir: vi.fn(),
  readDir: vi.fn(),
  readTextFile: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  writeTextFile: vi.fn(),
  rename: vi.fn(),
  remove: vi.fn(),
}));

const metadata = (isDirectory = false, fileAttributes = 0) => ({
  isFile: !isDirectory,
  isDirectory,
  isSymlink: false,
  size: 20,
  mtime: new Date(1234),
  atime: null,
  birthtime: null,
  readonly: false,
  fileAttributes,
  dev: null,
  ino: null,
  mode: null,
  nlink: null,
  uid: null,
  gid: null,
  rdev: null,
  blksize: null,
  blocks: null,
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(isTauri).mockReturnValue(true);
  vi.mocked(lstat).mockImplementation((path) => Promise.resolve(metadata(path === 'C:/Vault')));
});

describe('native vault filesystem safety and failures', () => {
  it('never recreates a notes folder that disappeared after its snapshot was loaded', async () => {
    vi.mocked(lstat).mockRejectedValueOnce(new Error('os error 2'));
    const files = new TauriVaultFileSystem(() => Promise.resolve('C:/Vault'), false);
    await expect(files.initialize()).rejects.toThrow('Restore it');
    expect(mkdir).not.toHaveBeenCalled();
  });
  it('reads metadata, text, and bytes only from resolved vault paths', async () => {
    const files = new TauriVaultFileSystem(() => Promise.resolve('C:/Vault'));
    await files.initialize();
    vi.mocked(readTextFile).mockResolvedValue('සිංහල 🌼');
    vi.mocked(readFile).mockResolvedValue(new Uint8Array([1, 2]));
    expect(await files.metadata('Note.md')).toEqual({ type: 'file', modifiedAt: 1234 });
    expect(await files.readText('Note.md')).toBe('සිංහල 🌼');
    expect(await files.readBytes('.attachments/image.png')).toEqual(new Uint8Array([1, 2]));
    expect(readTextFile).toHaveBeenCalledWith('C:/Vault/Note.md');
    await expect(files.readText('../secret.md')).rejects.toThrow('inside the vault');
  });

  it('creates a missing vault and returns null only for missing metadata', async () => {
    vi.mocked(lstat).mockRejectedValueOnce(new Error('os error 2'));
    const files = new TauriVaultFileSystem(() => Promise.resolve('C:/Vault'));
    await files.initialize();
    expect(mkdir).toHaveBeenCalledWith('C:/Vault', { recursive: true });
    vi.mocked(lstat).mockImplementation((path) =>
      path === 'C:/Vault'
        ? Promise.resolve(metadata(true))
        : Promise.reject(new Error('not found')),
    );
    expect(await files.metadata('Missing.md')).toBeNull();
    vi.mocked(lstat).mockRejectedValue(new Error('Access denied'));
    await expect(files.metadata('Private.md')).rejects.toThrow('denied');
  });

  it('rejects junction roots and linked ancestors', async () => {
    vi.mocked(lstat).mockResolvedValue(metadata(true, 0x400));
    await expect(
      new TauriVaultFileSystem(() => Promise.resolve('C:/Vault')).initialize(),
    ).rejects.toThrow('real directory');
    vi.mocked(lstat).mockImplementation((path) =>
      Promise.resolve(metadata(true, path === 'C:/Vault/Escape' ? 0x400 : 0)),
    );
    const files = new TauriVaultFileSystem(() => Promise.resolve('C:/Vault'));
    await files.initialize();
    await expect(files.readText('Escape/Secret.md')).rejects.toThrow('junctions');
    expect(readTextFile).not.toHaveBeenCalled();
  });

  it('detects linked directory entries and reports a concurrent deletion', async () => {
    const files = new TauriVaultFileSystem(() => Promise.resolve('C:/Vault'));
    await files.initialize();
    vi.mocked(readDir).mockResolvedValue([
      { name: 'shortcut', isSymlink: true, isDirectory: true, isFile: false },
      { name: 'Note.md', isSymlink: false, isDirectory: false, isFile: true },
    ]);
    expect(await files.readDirectory('')).toEqual([
      { name: 'shortcut', type: 'link' },
      { name: 'Note.md', type: 'file' },
    ]);
    vi.mocked(lstat).mockImplementation((path) =>
      path === 'C:/Vault'
        ? Promise.resolve(metadata(true))
        : Promise.reject(new Error('not found')),
    );
    await expect(files.readDirectory('')).rejects.toThrow('vault changed');
  });

  it('writes exclusive temporary files and only permits permanent removal of internal temporary files', async () => {
    const files = new TauriVaultFileSystem(() => Promise.resolve('C:/Vault'));
    await files.initialize();
    await files.writeText('.anehalo-save.tmp', 'latest');
    await files.writeBytes('.attachments/.anehalo-image.tmp', new Uint8Array([3]));
    await files.createDirectory('Work');
    await files.rename('.anehalo-save.tmp', 'Note.md');
    await files.removeTemporaryFile('.anehalo-save.tmp');
    expect(writeTextFile).toHaveBeenCalledWith('C:/Vault/.anehalo-save.tmp', 'latest', {
      createNew: true,
    });
    expect(writeFile).toHaveBeenCalledWith(
      'C:/Vault/.attachments/.anehalo-image.tmp',
      new Uint8Array([3]),
      { createNew: true },
    );
    expect(rename).toHaveBeenCalledWith('C:/Vault/.anehalo-save.tmp', 'C:/Vault/Note.md');
    expect(remove).toHaveBeenCalledWith('C:/Vault/.anehalo-save.tmp');
    await expect(files.removeTemporaryFile('Note.md')).rejects.toThrow('temporary file');
  });

  it('reports unavailable desktop access and rejects access before initialization', async () => {
    const files = new TauriVaultFileSystem(() => Promise.resolve('C:/Vault'));
    await expect(files.readText('Note.md')).rejects.toThrow('not initialized');
    vi.mocked(isTauri).mockReturnValue(false);
    await expect(files.initialize()).rejects.toThrow('desktop app');
  });
});
