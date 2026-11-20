import { describe, expect, it } from 'vitest';
import { filterItems } from '@/features/notes/filter-items';
import { diagramSummary } from '@/features/storage/vault-items';
import { InMemoryNoteRepository } from '@/features/storage/InMemoryNoteRepository';
import { unwrapResult } from '@/test/repository-helpers';

describe('filterItems', () => {
  it('filters folders, nested paths, title, and full text beyond the snippet', async () => {
    const repository = new InMemoryNoteRepository([
      { relativePath: 'Work/Login.md', type: 'file', content: 'Boundary password cases' },
      { relativePath: 'Work/Nested/Revision.md', type: 'file', content: 'Decision tables' },
      { relativePath: 'Workspace/Elsewhere.md', type: 'file', content: 'Unrelated' },
      { relativePath: 'Root.md', type: 'file', content: `${'Beginning '.repeat(30)}unique-token` },
    ]);
    const notes = unwrapResult(await repository.listTree()).notes;
    expect(filterItems(notes, { activeFolderPath: 'Work', searchText: '' })).toHaveLength(2);
    expect(
      filterItems(notes, { activeFolderPath: 'Work', searchText: '  PASSWORD ' }).map(
        (note) => note.title,
      ),
    ).toEqual(['Login']);
    expect(
      filterItems(notes, { activeFolderPath: null, searchText: 'revision' }).map(
        (note) => note.title,
      ),
    ).toEqual(['Revision']);
    expect(
      filterItems(notes, { activeFolderPath: null, searchText: 'unique-token' }).map(
        (note) => note.title,
      ),
    ).toEqual(['Root']);
    expect(filterItems(notes, { activeFolderPath: 'Work', searchText: 'Unrelated' })).toEqual([]);
    expect(filterItems(notes, { activeFolderPath: null, searchText: '' })).toHaveLength(4);
  });

  it('matches diagrams by title and folder', () => {
    const diagrams = [
      diagramSummary('Work/Flow.excalidraw', 1),
      diagramSummary('Plan.excalidraw', 2),
    ];
    expect(filterItems(diagrams, { activeFolderPath: 'Work', searchText: '' })).toEqual([
      diagrams[0],
    ]);
    expect(filterItems(diagrams, { activeFolderPath: null, searchText: 'plan' })).toEqual([
      diagrams[1],
    ]);
  });
});
