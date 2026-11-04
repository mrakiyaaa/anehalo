import type { NoteSummary } from '@/types/notes';
import { isInsideFolder } from '@/features/storage/storage-paths';

interface NoteFilters {
  activeFolderPath: string | null;
  searchText: string;
}

export function filterNotes(
  notes: readonly NoteSummary[],
  { activeFolderPath, searchText }: NoteFilters,
) {
  const normalizedSearch = searchText.trim().toLocaleLowerCase();

  return notes.filter((note) => {
    const matchesFolder =
      activeFolderPath === null || isInsideFolder(note.relativePath, activeFolderPath);
    const matchesSearch = `${note.title} ${note.searchText}`
      .toLocaleLowerCase()
      .includes(normalizedSearch);
    return matchesFolder && matchesSearch;
  });
}
