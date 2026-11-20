import { motion } from 'motion/react';
import { Settings as SettingsIcon } from 'lucide-react';
import { useDesktopRuntime } from '@/features/tray/desktop-context';
import { useSettingsStore } from '@/features/settings/use-settings-store';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/Icon';
import { Tooltip } from '@/components/ui/Tooltip';
import { StoragePathCard } from '@/components/layout/StoragePathCard';
import { SidebarRail } from '@/components/layout/SidebarRail';
import { useSidebarLayout } from '@/components/layout/use-sidebar-layout';
import { FolderList } from '@/features/folders/FolderList';
import { NoteSearch } from '@/features/notes/NoteSearch';
import { appShortcuts } from '@/features/shortcuts/app-shortcuts';
import { useWorkspaceStore } from '@/store/use-workspace-store';
import { shouldCollapse, useSidebarStore } from '@/store/sidebar-store';
import { SidebarItems } from '@/features/notes/SidebarItems';

export const SIDEBAR_WIDTH = 272;
export const RAIL_WIDTH = 64;

interface SidebarProps {
  onQuickNote: () => void;
  onNewDiagram: () => void;
}

function SidebarToggle({ collapsed }: { collapsed: boolean }) {
  const toggle = useSidebarStore((state) => state.toggle);
  const label = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
  return (
    <Tooltip label={`${label} (${appShortcuts.toggleSidebar.keys})`} side="right">
      <Button
        variant="ghost"
        className="rail-button sidebar-toggle"
        aria-label={label}
        aria-expanded={!collapsed}
        onClick={toggle}
      >
        <Icon name="panel-left" />
      </Button>
    </Tooltip>
  );
}

export function Sidebar({ onQuickNote, onNewDiagram }: SidebarProps) {
  useSidebarLayout();
  const runtime = useDesktopRuntime();
  const collapsed = useSidebarStore(shouldCollapse);
  const animate = useSidebarStore((state) => state.animate);
  const shortcut = useSettingsStore((state) => state.settings?.quickNoteShortcut);
  const diagramShortcut = useSettingsStore((state) => state.settings?.newDiagramShortcut);
  const isMutating = useWorkspaceStore((state) => state.isMutating);
  const vaultReady = useWorkspaceStore((state) => Boolean(state.tree.vaultPath));
  const diagramsAvailable = useWorkspaceStore((state) => state.diagramsAvailable);
  return (
    <motion.aside
      aria-label="Sidebar"
      className="app-sidebar"
      data-collapsed={collapsed}
      initial={false}
      animate={{ width: collapsed ? RAIL_WIDTH : SIDEBAR_WIDTH }}
      // Restoring a saved state must not animate; MotionConfig turns motion off for reduced motion.
      transition={animate ? { duration: 0.22, ease: [0.4, 0, 0.2, 1] } : { duration: 0 }}
    >
      <SidebarToggle collapsed={collapsed} />
      {collapsed ? (
        <SidebarRail onQuickNote={onQuickNote} onNewDiagram={onNewDiagram} />
      ) : (
        <>
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
          {diagramsAvailable && (
            <Button
              variant="outline"
              className="quick-note-button new-diagram-button"
              onClick={onNewDiagram}
              disabled={isMutating || !vaultReady}
            >
              <span className="quick-note-label">
                <Icon name="shapes" />
                New diagram
              </span>
              <span className="shortcut-keys" aria-hidden="true">
                {diagramShortcut?.replaceAll('+', ' ')}
              </span>
            </Button>
          )}
          <div className="sidebar-section-label">Folders</div>
          <FolderList />
          <SidebarItems />
        </>
      )}
      <div className="sidebar-footer">
        {!collapsed && <StoragePathCard />}
        <Tooltip label="Settings" side="right">
          <button
            type="button"
            className="settings-button"
            aria-label="Settings"
            onClick={() => runtime.openSettings()}
          >
            <SettingsIcon size={18} />
          </button>
        </Tooltip>
      </div>
    </motion.aside>
  );
}
