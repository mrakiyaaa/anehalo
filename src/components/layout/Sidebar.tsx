import { Settings as SettingsIcon } from 'lucide-react';
import { useDesktopRuntime } from '@/features/tray/desktop-context';
import { useSettingsStore } from '@/features/settings/use-settings-store';
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
  const runtime = useDesktopRuntime();
  const shortcut = useSettingsStore((state) => state.settings?.quickNoteShortcut);
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
          {shortcut?.replaceAll('+', ' ')}
        </span>
      </Button>
      <div className="sidebar-section-label">Folders</div>
      <FolderList />
      <SidebarNotes />
      <div className="sidebar-footer">
        <StoragePathCard />
        <button
          type="button"
          className="settings-button"
          aria-label="Settings"
          onClick={() => runtime.openSettings()}
        >
          <SettingsIcon size={18} />
        </button>
      </div>
    </aside>
  );
}
