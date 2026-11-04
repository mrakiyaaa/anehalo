import { filterNotes } from '@/features/notes/filter-notes';
import { NoteCard } from '@/features/notes/NoteCard';
import { mockFolders, mockNotes } from '@/lib/mock-data';
import { useWorkspaceStore } from '@/store/workspace-store';

export function RecentNotes() {
  const activeFolderId = useWorkspaceStore((state) => state.activeFolderId);
  const searchText = useWorkspaceStore((state) => state.searchText);
  const notes = filterNotes(mockNotes, { activeFolderId, searchText });
  const activeFolder = mockFolders.find((folder) => folder.id === activeFolderId);

  return (
    <section aria-labelledby="recent-notes-heading">
      <div className="notes-section-header">
        <h2 id="recent-notes-heading">{activeFolder?.name ?? 'Recent notes'}</h2>
        <span aria-live="polite">
          {notes.length} {notes.length === 1 ? 'note' : 'notes'} · last edited first
        </span>
      </div>
      <div className="notes-grid">
        {notes.map((note) => {
          const folder = mockFolders.find((candidate) => candidate.id === note.folderId);
          if (!folder) {
            return (
              <p className="notes-empty" role="alert" key={note.id}>
                This note’s folder could not be found.
              </p>
            );
          }
          return <NoteCard key={note.id} note={note} folder={folder} />;
        })}
        {notes.length === 0 && (
          <p className="notes-empty">No notes match. Try another search or folder.</p>
        )}
      </div>
    </section>
  );
}
