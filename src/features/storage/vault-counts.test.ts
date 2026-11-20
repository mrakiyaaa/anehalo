import { describe, expect, it } from 'vitest';
import type { Folder, NoteSummary } from '@/types/notes';
import { countItems, formatVaultCounts } from './vault-counts';
import { diagramSummary } from './vault-items';

function notes(...paths: string[]): NoteSummary[] {
  return paths.map((relativePath) => ({
    title: relativePath,
    folder: null,
    relativePath,
    modifiedAt: 1,
    snippet: '',
    searchText: '',
  }));
}

function folders(count: number): Folder[] {
  return Array.from({ length: count }, (_, index) => ({
    name: `Folder ${index}`,
    relativePath: `Folder ${index}`,
    parent: null,
  }));
}

describe('vault counts', () => {
  it.each([
    [0, 0, 0, '0 notes · 0 folders'],
    [1, 1, 1, '1 note · 1 diagram · 1 folder'],
    [5, 2, 2, '5 notes · 2 diagrams · 2 folders'],
  ])(
    'describes %i notes, %i diagrams and %i folders',
    (noteCount, diagramCount, folderCount, text) => {
      expect(
        formatVaultCounts({
          notes: notes(...Array.from({ length: noteCount }, (_, index) => `${index}.md`)),
          diagrams: Array.from({ length: diagramCount }, (_, index) =>
            diagramSummary(`${index}.excalidraw`, 1),
          ),
          folders: folders(folderCount),
        }),
      ).toBe(text);
    },
  );

  it('counts notes and diagrams inside a folder and its subfolders', () => {
    const tree = {
      notes: notes('Work/A.md', 'Work/Deep/B.md', 'Workspace/C.md'),
      diagrams: [diagramSummary('Work/Flow.excalidraw', 1), diagramSummary('Plan.excalidraw', 1)],
    };
    expect(countItems(tree, 'Work')).toBe(3);
    expect(countItems(tree, null)).toBe(5);
  });
});
