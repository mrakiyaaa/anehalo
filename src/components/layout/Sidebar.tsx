import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/Icon';
import { StoragePathCard } from '@/components/layout/StoragePathCard';
import { FolderList } from '@/features/folders/FolderList';
import { NoteSearch } from '@/features/notes/NoteSearch';
import { useWorkspaceStore } from '@/store/use-workspace-store';
import { SidebarNotes } from '@/features/notes/SidebarNotes';

interface SidebarProps {
  onQuickNote: () => void;
}

export function Sidebar({ onQuickNote }: SidebarProps) {
  const isMutating = useWorkspaceStore((state) => state.isMutating);
  const vaultReady = useWorkspaceStore((state) => Boolean(state.tree.vaultPath));
  return (
    <aside aria-label="Sidebar" className="app-sidebar">
      <NoteSearch />
      <Button
        className="quick-note-button"
        onClick={onQuickNote}
        disabled={isMutating || !vaultReady}
      >
        <span className="quick-note-label">
          <Icon name="plus" />
          Quick note
        </span>
        <span className="shortcut-keys" aria-hidden="true">
          Ctrl Alt N
        </span>
      </Button>
      <div className="sidebar-section-label">Folders</div>
      <FolderList />
      <SidebarNotes />
      <StoragePathCard />
    </aside>
  );
}
