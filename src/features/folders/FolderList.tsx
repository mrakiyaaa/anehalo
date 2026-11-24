import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { IconBadge } from '@/components/ui/IconBadge';
import { InlineNameForm } from '@/components/ui/InlineNameForm';
import { ItemMenu } from '@/components/ui/ItemMenu';
import { FolderButton } from '@/features/folders/FolderButton';
import { countItems } from '@/features/storage/vault-counts';
import { folderTone } from '@/lib/folder-tone';
import { useWorkspaceStore } from '@/store/use-workspace-store';
import { useDiagramImport } from '@/features/diagram-import/import-context';

export function FolderList() {
  const [isCreating, setIsCreating] = useState(false);
  const tree = useWorkspaceStore((state) => state.tree);
  const activeFolderPath = useWorkspaceStore((state) => state.activeFolderPath);
  const selectFolder = useWorkspaceStore((state) => state.selectFolder);
  const createFolder = useWorkspaceStore((state) => state.createFolder);
  const renameFolder = useWorkspaceStore((state) => state.renameFolder);
  const deleteFolder = useWorkspaceStore((state) => state.deleteFolder);
  const isMutating = useWorkspaceStore((state) => state.isMutating);
  const newDiagram = useWorkspaceStore((state) => state.newDiagram);
  const diagramsAvailable = useWorkspaceStore((state) => state.diagramsAvailable);
  const importer = useDiagramImport();
  return (
    <nav className="folder-list" aria-label="Folders">
      <FolderButton
        name="All items"
        tone="all"
        count={countItems(tree, null)}
        active={activeFolderPath === null}
        onSelect={() => selectFolder(null)}
      />
      {tree.folders.map((folder) => (
        <ItemMenu
          key={folder.relativePath}
          kind="folder"
          name={folder.name}
          path={folder.relativePath}
          {...(diagramsAvailable
            ? {
                onNewDiagram: () => {
                  void newDiagram(folder.relativePath);
                },
              }
            : {})}
          {...(importer
            ? { onImportDiagram: () => importer.chooseFiles(folder.relativePath) }
            : {})}
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
              count={countItems(tree, folder.relativePath)}
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
