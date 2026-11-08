import { describe, expect, it, vi } from 'vitest';
import { FileSystemNoteRepository } from './FileSystemNoteRepository';
import { InMemoryVaultFileSystem } from './InMemoryVaultFileSystem';
import type { VaultFileSystem } from './VaultFileSystem';
import { defaultScanLimits } from './ScanLimits';
import { unwrapResult } from '@/test/repository-helpers';

describe('bounded vault scanning', () => {
  it('reads only the vault, with zero reads of a large sibling folder', async () => {
    const disk = new InMemoryVaultFileSystem([
      { relativePath: 'Location/Anehalo/Keep.md', type: 'file', content: 'Keep' },
      ...Array.from({ length: 1000 }, (_, index) => ({
        relativePath: `Location/Sibling/Other ${index}.md`,
        type: 'file' as const,
        content: 'Other files',
      })),
    ]);
    const readDirectory = vi.spyOn(disk, 'readDirectory');
    const readText = vi.spyOn(disk, 'readText');
    const prefix = (path: string) => `Location/Anehalo${path ? `/${path}` : ''}`;
    const rooted: VaultFileSystem = {
      initialize: () => Promise.resolve('D:/Location/Anehalo'),
      metadata: (path) => disk.metadata(prefix(path)),
      readDirectory: (path, maximumEntries) => disk.readDirectory(prefix(path), maximumEntries),
      readText: (path) => disk.readText(prefix(path)),
      writeText: (path, content) => disk.writeText(prefix(path), content),
      createDirectory: (path) => disk.createDirectory(prefix(path)),
      rename: (source, destination) => disk.rename(prefix(source), prefix(destination)),
      removeTemporaryFile: (path) => disk.removeTemporaryFile(prefix(path)),
    };
    const tree = unwrapResult(await new FileSystemNoteRepository(rooted).listTree());
    expect(tree.notes.map((note) => note.title)).toEqual(['Keep']);
    expect(readDirectory.mock.calls.map(([path]) => path)).toEqual(['Location/Anehalo']);
    expect(readText.mock.calls.map(([path]) => path)).toEqual(['Location/Anehalo/Keep.md']);
  });

  it('caps all entries, including non-Markdown files, before reading anything beyond the cap', async () => {
    const files = new InMemoryVaultFileSystem(
      Array.from({ length: 20_001 }, (_, index) => ({
        relativePath: `${index}.txt`,
        type: 'file' as const,
      })),
    );
    const read = vi.spyOn(files, 'readText');
    const result = await new FileSystemNoteRepository(files).listTree();
    expect(result).toMatchObject({
      ok: false,
      error: {
        code: 'scan-limit',
        message: 'Could not load the vault. This folder has too many items to be a notes folder',
      },
    });
    expect(read).not.toHaveBeenCalled();
  });

  it('stops at the time budget and does not start another file read', async () => {
    let elapsed = 0;
    const files = new InMemoryVaultFileSystem(
      Array.from({ length: 20 }, (_, index) => ({
        relativePath: `${index}.md`,
        type: 'file' as const,
      })),
    );
    const readText = files.readText.bind(files);
    const read = vi.spyOn(files, 'readText').mockImplementation((path) => {
      elapsed += 6;
      return readText(path);
    });
    const repository = new FileSystemNoteRepository(files, {
      now: () => elapsed,
      yieldToInput: () => Promise.resolve(),
    });
    expect(
      await repository.listTree({ ...defaultScanLimits, maximumDurationMilliseconds: 10 }),
    ).toMatchObject({ ok: false, error: { code: 'scan-limit' } });
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('times out a stalled directory operation without waiting forever', async () => {
    const files = new InMemoryVaultFileSystem();
    vi.spyOn(files, 'readDirectory').mockImplementation(() => new Promise(() => undefined));
    expect(
      await new FileSystemNoteRepository(files).listTree({
        ...defaultScanLimits,
        maximumDurationMilliseconds: 10,
      }),
    ).toMatchObject({ ok: false, error: { code: 'scan-limit' } });
  });

  it('skips dot-folders, managed data, links and junctions, and reads Markdown only', async () => {
    const files = new InMemoryVaultFileSystem([
      { relativePath: 'Work/Visible.MD', type: 'file', content: 'Visible' },
      { relativePath: 'image.png', type: 'file', content: 'Image' },
      { relativePath: '.hidden/Secret.md', type: 'file' },
      { relativePath: '.attachments/Asset.md', type: 'file' },
      { relativePath: '.trash/Deleted.md', type: 'file' },
      { relativePath: 'Junction', type: 'link' },
    ]);
    const read = vi.spyOn(files, 'readText');
    const directories = vi.spyOn(files, 'readDirectory');
    expect(
      unwrapResult(await new FileSystemNoteRepository(files).listTree()).notes.map(
        (note) => note.title,
      ),
    ).toEqual(['Visible']);
    expect(read.mock.calls.map(([path]) => path)).toEqual(['Work/Visible.MD']);
    expect(directories.mock.calls.map(([path]) => path)).toEqual(['', 'Work']);
  });

  it('yields between small batches so input tasks run before the scan completes', async () => {
    const files = new InMemoryVaultFileSystem(
      Array.from({ length: 40 }, (_, index) => ({
        relativePath: `${index}.md`,
        type: 'file' as const,
      })),
    );
    let inputHandled = false;
    setTimeout(() => {
      inputHandled = true;
    }, 0);
    const tree = unwrapResult(
      await new FileSystemNoteRepository(files).listTree({ ...defaultScanLimits, batchSize: 2 }),
    );
    expect(tree.notes).toHaveLength(40);
    expect(inputHandled).toBe(true);
  });

  it('prepares a large note asynchronously and stops excessive payloads before parsing', async () => {
    const content = '**Readable** '.repeat(1000);
    const files = new InMemoryVaultFileSystem([
      { relativePath: 'Large.md', type: 'file', content },
    ]);
    const repository = new FileSystemNoteRepository(files);
    expect(unwrapResult(await repository.listTree()).notes[0]?.searchText).toContain('Readable');
    expect(
      await repository.listTree({ ...defaultScanLimits, maximumContentBytes: 1 }),
    ).toMatchObject({ ok: false, error: { code: 'scan-limit' } });
  });
});
