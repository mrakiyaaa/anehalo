import { afterEach, describe, expect, it, vi } from 'vitest';
import { diagramFile, editOutsideAnehalo, memoryVault, sceneWith } from '@/test/diagram-helpers';
import type { MemoryEntry } from '@/features/storage/InMemoryVaultFileSystem';
import type { DiagramScene } from '@/features/diagrams/diagram-codec';
import { MemoryThumbnailFiles } from './thumbnail-files';
import { ThumbnailCache, type Thumbnail } from './thumbnail-cache';
import { ThumbnailService } from './thumbnail-service';

const logFailure = vi.hoisted(() => vi.fn());
vi.mock('@/features/diagnostics/error-logging', () => ({ logFailure }));

/** Draws a "thumbnail" naming the elements, so tests can tell which version was drawn. */
const fakeRender = vi.fn((scene: DiagramScene): Promise<Thumbnail> => {
  const ids = scene.elements.filter((element) => !element.isDeleted).map(({ id }) => id);
  return Promise.resolve(
    ids.length === 0
      ? { state: 'empty' }
      : { state: 'image', bytes: new TextEncoder().encode(ids.join(',')), mimeType: 'image/png' },
  );
});

function setup(seed: readonly MemoryEntry[]) {
  let time = 1_000;
  const vault = memoryVault(seed, () => (time += 1_000));
  const service = new ThumbnailService({
    cache: new ThumbnailCache(new MemoryThumbnailFiles(), 'Memory/Anehalo'),
    diagrams: vault.diagrams,
    render: fakeRender,
    waitForIdle: () => Promise.resolve(),
    afterSaveDelayMs: 50,
  });
  return { ...vault, service };
}

function drawn(thumbnail: Thumbnail | null) {
  return thumbnail?.state === 'image' ? new TextDecoder().decode(thumbnail.bytes) : thumbnail;
}

afterEach(() => {
  fakeRender.mockClear();
  logFailure.mockClear();
  vi.useRealTimers();
});

describe('thumbnail service', () => {
  it('draws a missing thumbnail once and serves it from the cache after that', async () => {
    const { service } = setup([
      { relativePath: 'Flow.excalidraw', type: 'file', content: diagramFile('start', 'end') },
    ]);
    expect(drawn(await service.thumbnail('Flow.excalidraw'))).toBe('start,end');
    expect(drawn(await service.thumbnail('Flow.excalidraw'))).toBe('start,end');
    expect(fakeRender).toHaveBeenCalledTimes(1);
  });

  it('draws again after the file changed outside Anehalo', async () => {
    const { service, files } = setup([
      { relativePath: 'Flow.excalidraw', type: 'file', content: diagramFile('start') },
    ]);
    expect(drawn(await service.thumbnail('Flow.excalidraw'))).toBe('start');
    await editOutsideAnehalo(files, 'Flow.excalidraw', diagramFile('start', 'middle', 'end'));
    expect(drawn(await service.thumbnail('Flow.excalidraw'))).toBe('start,middle,end');
  });

  it('shows an empty placeholder for an empty diagram', async () => {
    const { service } = setup([
      { relativePath: 'Empty.excalidraw', type: 'file', content: diagramFile() },
    ]);
    expect(await service.thumbnail('Empty.excalidraw')).toEqual({ state: 'empty' });
  });

  it('gives a corrupt diagram an error placeholder, logged once and never redrawn', async () => {
    const { service } = setup([
      { relativePath: 'Broken.excalidraw', type: 'file', content: '{"type":"excal' },
    ]);
    expect(await service.thumbnail('Broken.excalidraw')).toEqual({ state: 'error' });
    expect(await service.thumbnail('Broken.excalidraw')).toEqual({ state: 'error' });
    expect(logFailure.mock.calls.filter(([event]) => event === 'thumbnail-failed')).toHaveLength(1);
    expect(fakeRender).not.toHaveBeenCalled();
  });

  it('returns null for a diagram that no longer exists', async () => {
    const { service } = setup([]);
    expect(await service.thumbnail('Gone.excalidraw')).toBeNull();
  });

  it('redraws the open diagram once editing pauses after saves, and says so', async () => {
    const { service, diagrams } = setup([
      { relativePath: 'Flow.excalidraw', type: 'file', content: diagramFile('start') },
    ]);
    const redrawn = vi.fn();
    service.subscribe(redrawn);
    await diagrams.writeDiagram('Flow.excalidraw', sceneWith('start', 'end'));
    service.sceneSaved('Flow.excalidraw', sceneWith('start'));
    service.sceneSaved('Flow.excalidraw', sceneWith('start', 'end'));

    await vi.waitFor(() => expect(redrawn).toHaveBeenCalledWith('Flow.excalidraw'));
    expect(fakeRender).toHaveBeenCalledTimes(1);
    expect(drawn(await service.thumbnail('Flow.excalidraw'))).toBe('start,end');
    expect(fakeRender).toHaveBeenCalledTimes(1);
  });

  it('keeps cached thumbnails through renames and drops them with trash', async () => {
    const { service, diagrams } = setup([
      { relativePath: 'Flow.excalidraw', type: 'file', content: diagramFile('start') },
    ]);
    await service.thumbnail('Flow.excalidraw');
    const renamed = await diagrams.renameDiagram('Flow.excalidraw', 'Pipeline');
    if (!renamed.ok) throw new Error(renamed.error.message);
    await service.moved('Flow.excalidraw', renamed.value.relativePath);
    expect(drawn(await service.thumbnail('Pipeline.excalidraw'))).toBe('start');
    expect(fakeRender).toHaveBeenCalledTimes(1);

    await service.removed('Pipeline.excalidraw');
    expect(drawn(await service.thumbnail('Pipeline.excalidraw'))).toBe('start');
    expect(fakeRender).toHaveBeenCalledTimes(2);
  });
});
