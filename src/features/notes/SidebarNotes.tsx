import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/Icon';
import { ItemMenu } from '@/components/ui/ItemMenu';
import { filterNotes } from '@/features/notes/filter-notes';
import { useWorkspaceStore } from '@/store/use-workspace-store';
import { Logo } from '@/components/ui/Logo';

export function SidebarNotes() {
  const tree = useWorkspaceStore((state) => state.tree);
  const activeFolderPath = useWorkspaceStore((state) => state.activeFolderPath);
  const searchText = useWorkspaceStore((state) => state.searchText);
  const current = useWorkspaceStore((state) => state.openDraft);
  const view = useWorkspaceStore((state) => state.view);
  const openNote = useWorkspaceStore((state) => state.openNote);
  const pendingDrafts = useWorkspaceStore((state) => state.pendingDrafts);
  const renameNote = useWorkspaceStore((state) => state.renameNote);
  const deleteNote = useWorkspaceStore((state) => state.deleteNote);
  const notes = filterNotes(tree.notes, { activeFolderPath, searchText });
  const retainedDrafts = pendingDrafts.filter(
    (draft) => !notes.some((note) => note.relativePath === draft.note.relativePath),
  );
  return (
    <>
      <div className="sidebar-section-label">Notes</div>
      <nav className="sidebar-notes" aria-label="Notes">
        {notes.map((note) => (
          <ItemMenu
            key={note.relativePath}
            kind="note"
            name={note.title}
            notePath={note.relativePath}
            onRename={(name) => renameNote(note.relativePath, name)}
            onDelete={() => deleteNote(note.relativePath)}
          >
            <Button
              variant="ghost"
              className="sidebar-note"
              aria-current={
                view === 'editor' && current?.note.relativePath === note.relativePath
                  ? 'page'
                  : undefined
              }
              title={note.relativePath}
              onClick={() => {
                void openNote(note.relativePath);
              }}
            >
              <Icon name="pen" />
              <span>{note.title}</span>
              {pendingDrafts.some((draft) => draft.note.relativePath === note.relativePath) && (
                <span className="unsaved-dot" aria-label="Unsaved changes" />
              )}
            </Button>
          </ItemMenu>
        ))}
        {notes.length === 0 && (
          <div className="sidebar-notes-empty">
            <Logo variant="full" />
            <p>{searchText.trim() ? 'No notes match your search' : 'No notes here yet'}</p>
          </div>
        )}
      </nav>
      {retainedDrafts.length > 0 && (
        <>
          <div className="sidebar-section-label">Unsaved drafts</div>
          <nav className="sidebar-notes" aria-label="Unsaved drafts">
            {retainedDrafts.map((draft) => (
              <Button
                key={draft.identifier}
                variant="ghost"
                className="sidebar-note"
                title={draft.note.relativePath}
                onClick={() => {
                  void openNote(draft.note.relativePath);
                }}
              >
                <Icon name="pen" />
                <span>{draft.title || 'Untitled note'}</span>
                <span className="unsaved-dot" />
              </Button>
            ))}
          </nav>
        </>
      )}
    </>
  );
}
