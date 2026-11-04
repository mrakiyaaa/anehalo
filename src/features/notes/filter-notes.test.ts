import { describe, expect, it } from 'vitest';
import { filterNotes } from '@/features/notes/filter-notes';
import { mockNotes } from '@/lib/mock-data';

describe('filterNotes', () => {
  it('returns all notes in their original recent order without filters', () => {
    expect(filterNotes(mockNotes, { activeFolderId: null, searchText: '' })).toEqual(mockNotes);
  });

  it('filters by folder', () => {
    expect(
      filterNotes(mockNotes, { activeFolderId: 'projects', searchText: '' }).map((note) => note.id),
    ).toEqual(['anehalo-features', 'anehalo-phases']);
  });

  it('matches titles regardless of case or surrounding whitespace', () => {
    expect(
      filterNotes(mockNotes, { activeFolderId: null, searchText: '  PLAYWRIGHT  ' }).map(
        (note) => note.id,
      ),
    ).toEqual(['playwright-locators']);
  });

  it('matches note text', () => {
    expect(
      filterNotes(mockNotes, { activeFolderId: null, searchText: 'boundary' }).map(
        (note) => note.id,
      ),
    ).toEqual(['login-flow', 'istqb-revision']);
  });

  it('requires both folder and search to match', () => {
    expect(
      filterNotes(mockNotes, { activeFolderId: 'study', searchText: 'boundary' }).map(
        (note) => note.id,
      ),
    ).toEqual(['istqb-revision']);
    expect(filterNotes(mockNotes, { activeFolderId: 'work', searchText: 'laundry' })).toEqual([]);
  });

  it('returns no matches without changing the source notes', () => {
    expect(filterNotes(mockNotes, { activeFolderId: null, searchText: 'no-such-note' })).toEqual(
      [],
    );
    expect(mockNotes).toHaveLength(8);
  });
});
