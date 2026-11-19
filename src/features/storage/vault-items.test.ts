import { describe, expect, it } from 'vitest';
import type { VaultTree } from '@/types/notes';
import { diagramSummary, folderItemCounts, itemKind, itemTitle, recentItems } from './vault-items';

const note = (relativePath: string, modifiedAt: number) => ({
  relativePath,
  title: itemTitle(relativePath, 'note'),
  folder: relativePath.includes('/') ? (relativePath.split('/')[0] ?? null) : null,
  modifiedAt,
  snippet: '',
  searchText: '',
});

const tree: VaultTree = {
  vaultPath: 'Vault',
  folders: [{ name: 'Plans', relativePath: 'Plans', parent: null }],
  notes: [note('Plans/Goals.md', 30), note('Idea.md', 10)],
  diagrams: [diagramSummary('Plans/Flow.excalidraw', 20), diagramSummary('Sketch.excalidraw', 40)],
};

describe('vault items', () => {
  it.each([
    ['Plan.md', 'note'],
    ['Plans/Plan.MD', 'note'],
    ['Flow.excalidraw', 'diagram'],
    ['Flow.Excalidraw', 'diagram'],
    ['photo.png', null],
    ['Flow.excalidraw.json', null],
    ['notes.md.bak', null],
  ])('treats %s as %s', (path, kind) => {
    expect(itemKind(path)).toBe(kind);
  });

  it('titles a diagram by its file name without the extension', () => {
    expect(diagramSummary('Plans/Big Flow.excalidraw', 5)).toEqual({
      kind: 'diagram',
      title: 'Big Flow',
      folder: 'Plans',
      relativePath: 'Plans/Big Flow.excalidraw',
      modifiedAt: 5,
    });
  });

  it('lists recent notes and diagrams together, newest first, with their kind', () => {
    expect(recentItems(tree, 3).map(({ kind, title }) => `${kind}:${title}`)).toEqual([
      'diagram:Sketch',
      'note:Goals',
      'diagram:Flow',
    ]);
  });

  it('counts the items in each folder per kind', () => {
    const counts = folderItemCounts(tree);
    expect(counts.get('Plans')).toEqual({ note: 1, diagram: 1 });
    expect(counts.get('')).toEqual({ note: 1, diagram: 1 });
  });
});
