import { waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Importing loads Excalidraw, which probes a 2D canvas when it loads; jsdom has none.
vi.hoisted(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: () => ({}),
  });
});
import type { ImportCandidate } from '@/features/diagram-import/DiagramImportService';
import { InMemoryNoteRepository } from '@/features/storage/InMemoryNoteRepository';
import type { MemoryEntry } from '@/features/storage/InMemoryVaultFileSystem';
import { fakeDiagramCodec } from '@/test/diagram-helpers';
import { unwrapResult } from '@/test/repository-helpers';
import { createWorkspaceStore, type WorkspaceStore } from './workspace-store';

const stores: WorkspaceStore[] = [];
afterEach(() => stores.splice(0).forEach((store) => store.getState().pauseAutoSave()));

/** A text element with every field Excalidraw writes, as the real codec restores files. */
const drawing = (words: string, link?: string) =>
  JSON.stringify({
    type: 'excalidraw',
    version: 2,
    source: 'https://excalidraw.com',
    elements: [
      {
        id: 'label',
        type: 'text',
        x: 0,
        y: 0,
        width: 200,
        height: 25,
        angle: 0,
        strokeColor: '#1e1e1e',
        backgroundColor: 'transparent',
        fillStyle: 'solid',
        strokeWidth: 2,
        strokeStyle: 'solid',
        roughness: 1,
        opacity: 100,
        groupIds: [],
        frameId: null,
        index: null,
        roundness: null,
        seed: 1,
        version: 1,
        versionNonce: 7,
        isDeleted: false,
        boundElements: null,
        updated: 1731000000000,
        link: link ?? null,
        locked: false,
        text: words,
        originalText: words,
        fontSize: 20,
        fontFamily: 5,
        textAlign: 'left',
        verticalAlign: 'top',
        containerId: null,
        autoResize: true,
        lineHeight: 1.25,
      },
    ],
    appState: {},
    files: {},
  });

function file(name: string, text: string): ImportCandidate & { original: Uint8Array } {
  const original = new TextEncoder().encode(text);
  return { name, size: original.length, bytes: () => Promise.resolve(original), original };
}

async function setup(seed: readonly MemoryEntry[] = []) {
  const repository = new InMemoryNoteRepository(seed);
  const store = createWorkspaceStore(repository, {
    diagramCodec: () => Promise.resolve(fakeDiagramCodec),
  });
  stores.push(store);
  await store.getState().initialize();
  const importFiles = async (candidates: ImportCandidate[], folder: string | null = null) =>
    unwrapResult(
      await store.getState().importDiagramFiles(candidates, folder, () => Promise.resolve(true)),
    );
  return { store, repository, importFiles, files: repository.memoryFileSystem };
}

const diagramPaths = (store: WorkspaceStore) =>
  store
    .getState()
    .tree.diagrams.map((diagram) => diagram.relativePath)
    .sort();

describe('importing diagram files into the vault', () => {
  it('copies a file under its own name, and numbers a name that is taken', async () => {
    const { store, importFiles, files } = await setup([
      { relativePath: 'Flow.excalidraw', type: 'file', content: drawing('mine') },
    ]);
    const original = file('Flow.excalidraw', drawing('imported'));

    await importFiles([original]);
    unwrapResult(await store.getState().goHome());
    await importFiles([original]);

    expect(diagramPaths(store)).toEqual([
      'Flow 2.excalidraw',
      'Flow 3.excalidraw',
      'Flow.excalidraw',
    ]);
    expect(await files.readText('Flow.excalidraw')).toBe(drawing('mine'));
    expect(await files.readText('Flow 2.excalidraw')).toBe(drawing('imported'));
  });

  it('imports into a folder, and into the vault root for null', async () => {
    const { store, importFiles } = await setup([{ relativePath: 'Work', type: 'directory' }]);
    await importFiles([file('A.excalidraw', drawing('a'))], 'Work');
    await importFiles([file('B.excalidraw', drawing('b'))], null);
    expect(diagramPaths(store)).toEqual(['B.excalidraw', 'Work/A.excalidraw']);
  });

  it('opens the diagram after one file, and stays put after several', async () => {
    const { store, importFiles } = await setup();
    await importFiles([file('Single.excalidraw', drawing('only'))]);
    expect(store.getState().view).toBe('diagram');
    expect(store.getState().diagram?.summary.relativePath).toBe('Single.excalidraw');

    unwrapResult(await store.getState().goHome());
    const report = await importFiles([
      file('One.excalidraw', drawing('one')),
      file('Two.excalidraw', drawing('two')),
    ]);
    expect(report.imported).toHaveLength(2);
    expect(store.getState().view).toBe('home');
    expect(diagramPaths(store)).toEqual(['One.excalidraw', 'Single.excalidraw', 'Two.excalidraw']);
  });

  it('writes nothing for a file that is not a drawing, and still imports the rest', async () => {
    const { store, importFiles, files } = await setup();
    const before = files.snapshot();
    const broken = file('Broken.excalidraw', '{"type":"excalidraw","elements":[');
    const foreign = file('Library.excalidraw', '{"type":"excalidrawlib","libraryItems":[]}');

    const report = await importFiles([broken, foreign, file('Good.excalidraw', drawing('ok'))]);

    expect(report.imported.map((diagram) => diagram.title)).toEqual(['Good']);
    expect(report.skipped.map(({ name }) => name)).toEqual([
      'Broken.excalidraw',
      'Library.excalidraw',
    ]);
    expect(diagramPaths(store)).toEqual(['Good.excalidraw']);
    expect(files.snapshot().filter((entry) => !entry.relativePath.includes('Good'))).toEqual(
      before,
    );
    expect(store.getState().view).toBe('home');
  });

  it('only reads the original, so its bytes are never changed', async () => {
    const { importFiles } = await setup();
    const original = file('Keep.excalidraw', drawing('keep'));
    const copy = [...original.original];
    await importFiles([original]);
    expect([...original.original]).toEqual(copy);
  });

  it('gives imported diagrams link and search entries through the shared scan', async () => {
    const { store, importFiles } = await setup([
      { relativePath: 'Plan.md', type: 'file', content: 'A plan' },
    ]);
    await importFiles(
      [
        file('Imported.excalidraw', drawing('quarterly roadmap', 'Plan.md')),
        file('Second.excalidraw', drawing('other words')),
      ],
      null,
    );
    await waitFor(async () =>
      expect(
        (await store.getState().searchIndex.search('roadmap', 'diagrams')).map(
          ({ item }) => item.relativePath,
        ),
      ).toEqual(['Imported.excalidraw']),
    );
    await waitFor(() =>
      expect(store.getState().links.backlinks.get('Plan.md')).toEqual(['Imported.excalidraw']),
    );
  });
});
