import { beforeEach, describe, expect, it, vi } from 'vitest';
import { lstat, writeTextFile } from '@tauri-apps/plugin-fs';
import { TauriVaultFileSystem, WRITE_CHUNK_CHARACTERS, textChunks } from './TauriVaultFileSystem';

vi.mock('@tauri-apps/api/core', () => ({ isTauri: () => true }));
vi.mock('@tauri-apps/api/path', () => ({
  resolve: (...parts: string[]) => Promise.resolve(parts.join('/')),
  join: (...parts: string[]) => Promise.resolve(parts.join('/')),
}));
vi.mock('@tauri-apps/plugin-fs', () => ({ lstat: vi.fn(), writeTextFile: vi.fn() }));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(lstat).mockResolvedValue({
    isFile: false,
    isDirectory: true,
    isSymlink: false,
    size: 0,
    mtime: new Date(1),
    atime: null,
    birthtime: null,
    readonly: false,
    fileAttributes: 0,
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
});

describe('writing large files in pieces', () => {
  it('splits text into pieces that join back to the original', () => {
    const text = 'abcdefghij';
    expect(textChunks(text, 4)).toEqual(['abcd', 'efgh', 'ij']);
    expect(textChunks('', 4)).toEqual(['']);
  });

  it('never cuts an emoji or other two-part character in half', () => {
    const chunks = textChunks('abc🌼def', 4);
    expect(chunks).toEqual(['abc', '🌼de', 'f']);
    expect(chunks.join('')).toBe('abc🌼def');
  });

  it('creates the file with the first piece and appends the rest', async () => {
    const files = new TauriVaultFileSystem(() => Promise.resolve('C:/Vault'));
    await files.initialize();
    const content = 'x'.repeat(WRITE_CHUNK_CHARACTERS * 2 + 10);

    await files.writeText('.anehalo-save.tmp', content);

    const calls = vi.mocked(writeTextFile).mock.calls;
    expect(calls.map(([, chunk, options]) => [chunk.length, options])).toEqual([
      [WRITE_CHUNK_CHARACTERS, { createNew: true }],
      [WRITE_CHUNK_CHARACTERS, { append: true }],
      [10, { append: true }],
    ]);
    expect(calls.every(([path]) => path === 'C:/Vault/.anehalo-save.tmp')).toBe(true);
  });
});
