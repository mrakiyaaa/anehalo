import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke, isTauri } from '@tauri-apps/api/core';
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
import { READ_BATCH_BYTES, TauriVaultFileSystem, decodeVaultReads } from './TauriVaultFileSystem';

/** A `read_vault_files` reply, as the Rust command encodes it. */
function vaultReadReply(
  results: readonly ({ text: string } | { code: string; message: string })[],
) {
  const encoder = new TextEncoder();
  const parts = results.map((result) => {
    const isText = 'text' in result;
    const payload = encoder.encode(isText ? result.text : JSON.stringify(result));
    const header = new DataView(new ArrayBuffer(5));
    header.setUint8(0, isText ? 0 : 1);
    header.setUint32(1, payload.length, true);
    return [new Uint8Array(header.buffer), payload];
  });
  const bytes = new Uint8Array(parts.flat().reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts.flat()) {
    bytes.set(part, offset);
    offset += part.length;
  }
  return bytes.buffer;
}

vi.mock('@tauri-apps/api/core', () => ({ isTauri: vi.fn(() => true), invoke: vi.fn() }));
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
    vi.mocked(invoke).mockResolvedValue(vaultReadReply([{ text: 'සිංහල 🌼' }]));
    vi.mocked(readFile).mockResolvedValue(new Uint8Array([1, 2]));
    expect(await files.metadata('Note.md')).toEqual({ type: 'file', modifiedAt: 1234, size: 20 });
    expect(await files.readText('Note.md')).toBe('සිංහල 🌼');
    expect(await files.readBytes('.attachments/image.png')).toEqual(new Uint8Array([1, 2]));
    expect(invoke).toHaveBeenCalledWith('read_vault_files', {
      vaultPath: 'C:/Vault',
      relativePaths: ['Note.md'],
      maximumBytes: READ_BATCH_BYTES,
    });
    vi.mocked(invoke).mockClear();
    await expect(files.readText('../secret.md')).rejects.toThrow('inside the vault');
    expect(invoke).not.toHaveBeenCalled();
  });

  it('reads a file in one native call that checks the path, not one call per folder', async () => {
    const files = new TauriVaultFileSystem(() => Promise.resolve('C:/Vault'));
    await files.initialize();
    vi.mocked(lstat).mockClear();
    vi.mocked(invoke).mockResolvedValue(vaultReadReply([{ text: 'deep' }]));
    expect(await files.readText('A/B/C/Deep.md')).toBe('deep');
    expect(invoke).toHaveBeenCalledOnce();
    expect(lstat).not.toHaveBeenCalled();
  });

  it('reads the settings folder, which is not a vault, through the file-system plugin', async () => {
    const files = new TauriVaultFileSystem(
      () => Promise.resolve('C:/Vault'),
      true,
      'file-system-plugin',
    );
    await files.initialize();
    vi.mocked(readTextFile).mockResolvedValue('{}');
    expect(await files.readText('settings.json')).toBe('{}');
    expect(readTextFile).toHaveBeenCalledWith('C:/Vault/settings.json');
    vi.mocked(readTextFile).mockRejectedValue(new Error('os error 2'));
    expect(await files.readTexts(['settings.json'])).toMatchObject([
      { ok: false, error: { code: 'not-found' } },
    ]);
    expect(invoke).not.toHaveBeenCalled();
  });

  it('reads several files in one call and keeps each failure to its own file', async () => {
    const files = new TauriVaultFileSystem(() => Promise.resolve('C:/Vault'));
    await files.initialize();
    vi.mocked(invoke).mockResolvedValue(
      vaultReadReply([
        { text: 'a' },
        { code: 'invalid-path', message: 'Symbolic links and junctions are not supported.' },
      ]),
    );
    expect(await files.readTexts(['A.md', 'Linked/B.md', 'C.md'])).toEqual([
      { ok: true, value: 'a' },
      {
        ok: false,
        error: { code: 'invalid-path', message: 'Symbolic links and junctions are not supported.' },
      },
    ]);
    vi.mocked(invoke).mockResolvedValue(
      vaultReadReply([{ code: 'not-found', message: 'The file no longer exists.' }]),
    );
    await expect(files.readText('Gone.md')).rejects.toMatchObject({
      storageError: { code: 'not-found', message: 'The file no longer exists.' },
    });
  });

  it('decodes a reply byte for byte, with a byte order mark removed as text reads do', () => {
    expect(decodeVaultReads(vaultReadReply([{ text: '\uFEFFසිංහල' }, { text: '' }]))).toEqual([
      { ok: true, value: 'සිංහල' },
      { ok: true, value: '' },
    ]);
    expect(decodeVaultReads(new ArrayBuffer(0))).toEqual([]);
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
    // Text reads check links in Rust (vault_access.rs tests); the other calls check them here.
    await expect(files.readBytes('Escape/Secret.png')).rejects.toThrow('junctions');
    await expect(files.metadata('Escape/Secret.md')).rejects.toThrow('junctions');
    expect(readFile).not.toHaveBeenCalled();
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
