import type { Note } from '@/types/notes';

interface NoteFilters {
  activeFolderId: string | null;
  searchText: string;
}

export function filterNotes(notes: readonly Note[], { activeFolderId, searchText }: NoteFilters) {
  const normalizedSearch = searchText.trim().toLocaleLowerCase();

  return notes.filter((note) => {
    const matchesFolder = activeFolderId === null || note.folderId === activeFolderId;
    const matchesSearch = `${note.title} ${note.text}`
      .toLocaleLowerCase()
      .includes(normalizedSearch);
    return matchesFolder && matchesSearch;
  });
}
