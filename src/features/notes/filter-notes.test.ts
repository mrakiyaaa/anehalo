import { describe, expect, it } from 'vitest';
import { filterNotes } from '@/features/notes/filter-notes';
import { InMemoryNoteRepository } from '@/features/storage/InMemoryNoteRepository';
import { unwrapResult } from '@/test/repository-helpers';

describe('filterNotes', () => {
  it('filters folders, nested paths, title, and full text beyond the snippet', async () => {
    const repository = new InMemoryNoteRepository([
      { relativePath: 'Work/Login.md', type: 'file', content: 'Boundary password cases' },
      { relativePath: 'Work/Nested/Revision.md', type: 'file', content: 'Decision tables' },
      { relativePath: 'Workspace/Elsewhere.md', type: 'file', content: 'Unrelated' },
      { relativePath: 'Root.md', type: 'file', content: `${'Beginning '.repeat(30)}unique-token` },
    ]);
    const notes = unwrapResult(await repository.listTree()).notes;
    expect(filterNotes(notes, { activeFolderPath: 'Work', searchText: '' })).toHaveLength(2);
    expect(
      filterNotes(notes, { activeFolderPath: 'Work', searchText: '  PASSWORD ' }).map(
        (note) => note.title,
      ),
    ).toEqual(['Login']);
    expect(
      filterNotes(notes, { activeFolderPath: null, searchText: 'revision' }).map(
        (note) => note.title,
      ),
    ).toEqual(['Revision']);
    expect(
      filterNotes(notes, { activeFolderPath: null, searchText: 'unique-token' }).map(
        (note) => note.title,
      ),
    ).toEqual(['Root']);
    expect(filterNotes(notes, { activeFolderPath: 'Work', searchText: 'Unrelated' })).toEqual([]);
    expect(filterNotes(notes, { activeFolderPath: null, searchText: '' })).toHaveLength(4);
  });
});
