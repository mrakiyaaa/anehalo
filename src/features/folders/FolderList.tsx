import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { IconBadge } from '@/components/ui/IconBadge';
import { InlineNameForm } from '@/components/ui/InlineNameForm';
import { ItemMenu } from '@/components/ui/ItemMenu';
import { FolderButton } from '@/features/folders/FolderButton';
import { isInsideFolder } from '@/features/storage/storage-paths';
import { folderTone } from '@/lib/folder-tone';
import { useWorkspaceStore } from '@/store/use-workspace-store';

export function FolderList() {
  const [isCreating, setIsCreating] = useState(false);
  const tree = useWorkspaceStore((state) => state.tree);
  const activeFolderPath = useWorkspaceStore((state) => state.activeFolderPath);
  const selectFolder = useWorkspaceStore((state) => state.selectFolder);
  const createFolder = useWorkspaceStore((state) => state.createFolder);
  const renameFolder = useWorkspaceStore((state) => state.renameFolder);
  const deleteFolder = useWorkspaceStore((state) => state.deleteFolder);
  const isMutating = useWorkspaceStore((state) => state.isMutating);
  return (
    <nav className="folder-list" aria-label="Folders">
      <FolderButton
        name="All notes"
        tone="all"
        count={tree.notes.length}
        active={activeFolderPath === null}
        onSelect={() => selectFolder(null)}
      />
      {tree.folders.map((folder) => (
        <ItemMenu
          key={folder.relativePath}
          kind="folder"
          name={folder.name}
          onRename={(name) => renameFolder(folder.relativePath, name)}
          onDelete={() => deleteFolder(folder.relativePath)}
        >
          <div
            style={{
              paddingLeft: `${Math.min(folder.relativePath.split('/').length - 1, 5) * 12}px`,
            }}
          >
            <FolderButton
              name={folder.name}
              tone={folderTone(folder.relativePath)}
              count={
                tree.notes.filter((note) => isInsideFolder(note.relativePath, folder.relativePath))
                  .length
              }
              active={activeFolderPath === folder.relativePath}
              onSelect={() => selectFolder(folder.relativePath)}
            />
          </div>
        </ItemMenu>
      ))}
      {isCreating ? (
        <InlineNameForm
          label="Folder name"
          onCancel={() => setIsCreating(false)}
          onSubmit={async (name) => {
            const result = await createFolder(name);
            if (result.ok) setIsCreating(false);
            return result;
          }}
        />
      ) : (
        <Button
          variant="ghost"
          className="folder-button new-folder-button"
          disabled={isMutating || !tree.vaultPath}
          onClick={() => setIsCreating(true)}
        >
          <IconBadge icon="plus" />
          <span className="folder-name">New folder</span>
        </Button>
      )}
    </nav>
  );
}
