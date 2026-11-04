import { filterNotes } from '@/features/notes/filter-notes';
import { NoteCard } from '@/features/notes/NoteCard';
import { useCurrentTime } from '@/lib/use-current-time';
import { useWorkspaceStore } from '@/store/use-workspace-store';

export function RecentNotes() {
  const tree = useWorkspaceStore((state) => state.tree);
  const activeFolderPath = useWorkspaceStore((state) => state.activeFolderPath);
  const searchText = useWorkspaceStore((state) => state.searchText);
  const isLoading = useWorkspaceStore((state) => state.isLoading);
  const currentTime = useCurrentTime();
  const notes = filterNotes(tree.notes, { activeFolderPath, searchText });
  const activeFolder = tree.folders.find((folder) => folder.relativePath === activeFolderPath);
  return (
    <section aria-labelledby="recent-notes-heading" aria-busy={isLoading}>
      <div className="notes-section-header">
        <h2 id="recent-notes-heading">{activeFolder?.name ?? 'Recent notes'}</h2>
        <span aria-live="polite">
          {isLoading
            ? 'Refreshing…'
            : `${notes.length} ${notes.length === 1 ? 'note' : 'notes'} · last edited first`}
        </span>
      </div>
      <div className="notes-grid">
        {notes.map((note) => (
          <NoteCard key={note.relativePath} note={note} currentTime={currentTime.getTime()} />
        ))}
        {notes.length === 0 && (
          <p className="notes-empty">
            {isLoading
              ? 'Opening your notes…'
              : searchText.trim()
                ? 'No notes match your search.'
                : 'No notes here yet. Use Quick note or start typing above.'}
          </p>
        )}
      </div>
    </section>
  );
}
