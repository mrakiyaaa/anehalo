import type { ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/button';
import { SaveStatusIndicator } from '@/components/ui/SaveStatusIndicator';
import { folderTone } from '@/lib/folder-tone';
import { pathName } from '@/features/storage/storage-paths';
import type { SaveStatus } from '@/features/storage/autosave/save-timing';
import { HistoryNavigation } from '@/features/navigation/HistoryNavigation';
import { useEditingLocked } from '@/features/editor/use-editing-locked';
import { useWorkspaceStore } from '@/store/use-workspace-store';

interface ItemHeaderProps {
  readonly status: SaveStatus;
  readonly folder: string | null;
  /** Extra actions next to the save status, such as Export for notes. */
  readonly actions?: ReactNode;
  /** The title field. */
  readonly children: ReactNode;
}

/** The header shared by the note and diagram screens. */
export function ItemHeader({ status, folder, actions, children }: ItemHeaderProps) {
  const goHome = useWorkspaceStore((state) => state.goHome);
  const isMutating = useEditingLocked();
  return (
    <header className="editor-header">
      <div className="editor-navigation">
        <div className="editor-navigation-buttons">
          <HistoryNavigation />
          <Button
            variant="ghost"
            className="editor-back"
            disabled={isMutating}
            onClick={() => {
              void goHome();
            }}
          >
            <Icon name="left" />
            Home
          </Button>
        </div>
        <div className="editor-export-actions">
          <SaveStatusIndicator status={status} />
          {actions}
        </div>
      </div>
      <div className="editor-title-row">{children}</div>
      <span
        className={`editor-folder-chip tone-${folderTone(folder)}`}
        title={folder ?? 'Vault root'}
      >
        <Icon name="folder" />
        {folder ? pathName(folder) : 'Vault root'}
      </span>
    </header>
  );
}
