import { waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { DiagramScene } from '@/features/diagrams/diagram-codec';
import { InMemoryNoteRepository } from '@/features/storage/InMemoryNoteRepository';
import type { MemoryEntry } from '@/features/storage/InMemoryVaultFileSystem';
import { editOutsideAnehalo, fakeDiagramCodec } from '@/test/diagram-helpers';
import { unwrapResult } from '@/test/repository-helpers';
import { createWorkspaceStore, type WorkspaceStore } from './workspace-store';

const diagramWith = (words: string, link?: string) =>
  JSON.stringify({
    type: 'excalidraw',
    elements: [{ id: 'label', type: 'text', text: words, ...(link ? { link } : {}) }],
  });

const stores: WorkspaceStore[] = [];
afterEach(() => stores.splice(0).forEach((store) => store.getState().pauseAutoSave()));

async function setup(seed: readonly MemoryEntry[]) {
  const repository = new InMemoryNoteRepository(seed);
  const files = repository.memoryFileSystem;
  const reads: string[] = [];
  const readText = files.readText.bind(files);
  files.readText = (path: string) => {
    if (path.endsWith('.excalidraw')) reads.push(path);
    return readText(path);
  };
  const store = createWorkspaceStore(repository, {
    diagramCodec: () => Promise.resolve(fakeDiagramCodec),
  });
  stores.push(store);
  await store.getState().initialize();
  return { store, files, reads };
}

const found = async (store: WorkspaceStore, query: string) =>
  (await store.getState().searchIndex.search(query, 'diagrams')).map(
    ({ item }) => item.relativePath,
  );

const generated = (count: number): MemoryEntry[] =>
  Array.from({ length: count }, (_, index) => ({
    relativePath: `Diagrams/D${index}.excalidraw`,
    type: 'file',
    content: diagramWith(`word${index}`, 'Plan.md'),
  }));

describe('one shared read of each diagram for links and search', () => {
  it('reads every diagram once at startup and not again on an unchanged refresh', async () => {
    const { store, reads } = await setup([
      { relativePath: 'Plan.md', type: 'file', content: 'A plan' },
      ...generated(50),
    ]);
    await waitFor(async () => expect(await found(store, 'word49')).toHaveLength(1));
    expect(store.getState().links.backlinks.get('Plan.md')).toHaveLength(50);
    expect(reads).toHaveLength(50);
    expect(new Set(reads).size).toBe(50);

    reads.length = 0;
    unwrapResult(await store.getState().refreshTree());
    await waitFor(() => expect(store.getState().searchIndex.isRefreshing).toBe(false));
    expect(reads).toEqual([]);
    expect(store.getState().links.backlinks.get('Plan.md')).toHaveLength(50);
  });

  it('re-reads only a diagram edited outside Anehalo', async () => {
    const { store, files, reads } = await setup(generated(3));
    await waitFor(async () => expect(await found(store, 'word2')).toHaveLength(1));
    reads.length = 0;
    await editOutsideAnehalo(files, 'Diagrams/D1.excalidraw', diagramWith('outside edit'));
    unwrapResult(await store.getState().refreshTree());
    await waitFor(async () =>
      expect(await found(store, 'outside')).toEqual(['Diagrams/D1.excalidraw']),
    );
    expect(reads).toEqual(['Diagrams/D1.excalidraw']);
    expect(await found(store, 'word1')).toEqual([]);
  });

  it('indexes an in-app save from the in-memory scene for both links and search', async () => {
    const { store, reads } = await setup([
      { relativePath: 'Plan.md', type: 'file', content: 'A plan' },
      { relativePath: 'Flow.excalidraw', type: 'file', content: diagramWith('before') },
    ]);
    await waitFor(async () => expect(await found(store, 'before')).toHaveLength(1));
    unwrapResult(await store.getState().openDiagramFile('Flow.excalidraw'));
    reads.length = 0;
    const scene = {
      elements: [{ id: 'label', type: 'text', text: 'after save', link: 'Plan.md', version: 2 }],
      appState: {},
      files: {},
    } as unknown as DiagramScene;
    store.getState().updateDiagram(scene);
    unwrapResult(await store.getState().saveDiagram());
    await waitFor(async () => expect(await found(store, 'after')).toEqual(['Flow.excalidraw']));
    expect(store.getState().links.backlinks.get('Plan.md')).toEqual(['Flow.excalidraw']);
    unwrapResult(await store.getState().refreshTree());
    await waitFor(() => expect(store.getState().searchIndex.isRefreshing).toBe(false));
    expect(reads).toEqual([]);
  });

  it('keeps search right through rename, move, trash and restore', async () => {
    const { store } = await setup([
      { relativePath: 'Work', type: 'directory' },
      { relativePath: 'Flow.excalidraw', type: 'file', content: diagramWith('gateway') },
    ]);
    await waitFor(async () => expect(await found(store, 'gateway')).toHaveLength(1));
    unwrapResult(await store.getState().renameDiagram('Flow.excalidraw', 'Pipeline'));
    expect(await found(store, 'pipeline')).toEqual(['Pipeline.excalidraw']);
    expect(await found(store, 'gateway')).toEqual(['Pipeline.excalidraw']);

    unwrapResult(await store.getState().moveDiagram('Pipeline.excalidraw', 'Work'));
    expect(await found(store, 'gateway')).toEqual(['Work/Pipeline.excalidraw']);

    unwrapResult(await store.getState().trashDiagram('Work/Pipeline.excalidraw'));
    expect(await found(store, 'gateway')).toEqual([]);
    unwrapResult(await store.getState().restoreDiagram('Work/Pipeline.excalidraw'));
    await waitFor(async () =>
      expect(await found(store, 'gateway')).toEqual(['Work/Pipeline.excalidraw']),
    );
  });
});
