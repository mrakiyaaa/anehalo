import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/Icon';
import { StoragePathCard } from '@/components/layout/StoragePathCard';
import { FolderList } from '@/features/folders/FolderList';
import { NoteSearch } from '@/features/notes/NoteSearch';

interface SidebarProps {
  onQuickNote: () => void;
}

export function Sidebar({ onQuickNote }: SidebarProps) {
  return (
    <aside aria-label="Sidebar" className="app-sidebar">
      <NoteSearch />
      <Button className="quick-note-button" onClick={onQuickNote}>
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
      <StoragePathCard />
    </aside>
  );
}
