import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Tooltip } from '@/components/ui/Tooltip';
import { FolderButton } from '@/features/folders/FolderButton';
import { countItems } from '@/features/storage/vault-counts';
import { folderTone } from '@/lib/folder-tone';
import { useWorkspaceStore } from '@/store/use-workspace-store';

interface RailButtonProps {
  readonly icon: IconName;
  readonly label: string;
  readonly disabled?: boolean;
  readonly onClick: () => void;
}

function RailButton({ icon, label, disabled = false, onClick }: RailButtonProps) {
  return (
    <Tooltip label={label} side="right">
      <Button
        variant="ghost"
        className="rail-button"
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
      >
        <Icon name={icon} />
      </Button>
    </Tooltip>
  );
}

interface SidebarRailProps {
  readonly onQuickNote: () => void;
  readonly onNewDiagram: () => void;
}

/** The collapsed sidebar: icons for the main actions and folders, each with a tooltip. */
export function SidebarRail({ onQuickNote, onNewDiagram }: SidebarRailProps) {
  const tree = useWorkspaceStore((state) => state.tree);
  const activeFolderPath = useWorkspaceStore((state) => state.activeFolderPath);
  const selectFolder = useWorkspaceStore((state) => state.selectFolder);
  const setSearchOpen = useWorkspaceStore((state) => state.setSearchOpen);
  const isMutating = useWorkspaceStore((state) => state.isMutating);
  const diagramsAvailable = useWorkspaceStore((state) => state.diagramsAvailable);
  const unavailable = isMutating || !tree.vaultPath;
  return (
    <nav className="sidebar-rail" aria-label="Sidebar shortcuts">
      <RailButton icon="search" label="Search notes" onClick={() => setSearchOpen(true)} />
      <RailButton icon="plus" label="Quick note" disabled={unavailable} onClick={onQuickNote} />
      {diagramsAvailable && (
        <RailButton
          icon="shapes"
          label="New diagram"
          disabled={unavailable}
          onClick={onNewDiagram}
        />
      )}
      <div className="rail-folders" role="group" aria-label="Folders">
        <FolderButton
          iconOnly
          name="All items"
          tone="all"
          count={countItems(tree, null)}
          active={activeFolderPath === null}
          onSelect={() => selectFolder(null)}
        />
        {tree.folders.map((folder) => (
          <FolderButton
            key={folder.relativePath}
            iconOnly
            name={folder.name}
            tone={folderTone(folder.relativePath)}
            count={countItems(tree, folder.relativePath)}
            active={activeFolderPath === folder.relativePath}
            onSelect={() => selectFolder(folder.relativePath)}
          />
        ))}
      </div>
    </nav>
  );
}
