import { describe, expect, it } from 'vitest';
import { MemoryThumbnailFiles } from './thumbnail-files';
import { ThumbnailCache, thumbnailKey, type Thumbnail } from './thumbnail-cache';

const vault = 'C:\\Users\\Ada\\Documents\\Anehalo';
const version = { modifiedAt: 1_000, size: 120 };
const image = (size = 4): Thumbnail => ({
  state: 'image',
  bytes: new Uint8Array(size).fill(7),
  mimeType: 'image/webp',
});

function setup(limitBytes?: number) {
  let time = 0;
  const files = new MemoryThumbnailFiles();
  const cache = new ThumbnailCache(files, vault, limitBytes, () => ++time);
  return { files, cache };
}

describe('thumbnail cache key', () => {
  it('names one file per vault and path, as Windows compares paths', async () => {
    const key = await thumbnailKey(vault, 'Plans/Flow.excalidraw');
    expect(key).toMatch(/^[0-9a-f]{32}$/);
    expect(await thumbnailKey('c:/users/ada/documents/anehalo/', 'plans/flow.excalidraw')).toBe(
      key,
    );
    expect(await thumbnailKey(vault, 'Plans/Other.excalidraw')).not.toBe(key);
    expect(await thumbnailKey('D:\\Elsewhere', 'Plans/Flow.excalidraw')).not.toBe(key);
  });
});

describe('thumbnail cache', () => {
  it('returns a thumbnail only for the file version it was made from', async () => {
    const { cache } = setup();
    expect(await cache.lookup('Flow.excalidraw', version)).toBeNull();
    await cache.store('Flow.excalidraw', version, image());
    expect(await cache.lookup('Flow.excalidraw', version)).toEqual(image());
    expect(await cache.lookup('Flow.excalidraw', { ...version, modifiedAt: 2_000 })).toBeNull();
    expect(await cache.lookup('Flow.excalidraw', { ...version, size: 121 })).toBeNull();
  });

  it('remembers empty and broken diagrams without keeping an image', async () => {
    const { cache, files } = setup();
    await cache.store('Empty.excalidraw', version, { state: 'empty' });
    await cache.store('Broken.excalidraw', version, { state: 'error' });
    expect(await cache.lookup('Empty.excalidraw', version)).toEqual({ state: 'empty' });
    expect(await cache.lookup('Broken.excalidraw', version)).toEqual({ state: 'error' });
    expect([...files.files.keys()]).toEqual(['index.json']);
  });

  it('follows a rename and a folder move, and forgets trashed diagrams and folders', async () => {
    const { cache } = setup();
    await cache.store('Work/Flow.excalidraw', version, image());
    await cache.store('Work/Deep/Plan.excalidraw', version, image());
    await cache.store('Notes.excalidraw', version, image());

    await cache.move('Work/Flow.excalidraw', 'Work/Pipeline.excalidraw');
    expect(await cache.lookup('Work/Flow.excalidraw', version)).toBeNull();
    expect(await cache.lookup('Work/Pipeline.excalidraw', version)).toEqual(image());

    await cache.move('Work', 'Projects');
    expect(await cache.lookup('Projects/Pipeline.excalidraw', version)).toEqual(image());
    expect(await cache.lookup('Projects/Deep/Plan.excalidraw', version)).toEqual(image());

    await cache.remove('Projects');
    expect(await cache.lookup('Projects/Pipeline.excalidraw', version)).toBeNull();
    expect(await cache.lookup('Notes.excalidraw', version)).toEqual(image());
    await cache.remove('Notes.excalidraw');
    expect(await cache.lookup('Notes.excalidraw', version)).toBeNull();
  });

  it('evicts the least recently used images above the size limit', async () => {
    const { cache } = setup(10);
    await cache.store('A.excalidraw', version, image(4));
    await cache.store('B.excalidraw', version, image(4));
    expect(await cache.lookup('A.excalidraw', version)).not.toBeNull();
    await cache.store('C.excalidraw', version, image(4));

    expect(await cache.lookup('B.excalidraw', version)).toBeNull();
    expect(await cache.lookup('A.excalidraw', version)).not.toBeNull();
    expect(await cache.lookup('C.excalidraw', version)).not.toBeNull();
  });

  it('starts over when the index is unreadable', async () => {
    const files = new MemoryThumbnailFiles();
    files.files.set('index.json', new TextEncoder().encode('{"format":1,"entr'));
    const cache = new ThumbnailCache(files, vault);
    expect(await cache.lookup('Flow.excalidraw', version)).toBeNull();
    await cache.store('Flow.excalidraw', version, image());
    expect(await cache.lookup('Flow.excalidraw', version)).toEqual(image());
  });
});
