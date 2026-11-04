import { Button } from '@/components/ui/button';
import { IconBadge } from '@/components/ui/IconBadge';
import { FolderButton } from '@/features/folders/FolderButton';
import { mockFolders, mockNotes } from '@/lib/mock-data';
import { useWorkspaceStore } from '@/store/workspace-store';

export function FolderList() {
  const activeFolderId = useWorkspaceStore((state) => state.activeFolderId);
  const selectFolder = useWorkspaceStore((state) => state.selectFolder);

  return (
    <nav className="folder-list" aria-label="Folders">
      <FolderButton
        name="All notes"
        tone="all"
        count={mockNotes.length}
        active={activeFolderId === null}
        onSelect={() => selectFolder(null)}
      />
      {mockFolders.map((folder) => (
        <FolderButton
          key={folder.id}
          name={folder.name}
          tone={folder.tone}
          count={mockNotes.filter((note) => note.folderId === folder.id).length}
          active={activeFolderId === folder.id}
          onSelect={() => selectFolder(folder.id)}
        />
      ))}
      <Button variant="ghost" className="folder-button new-folder-button" disabled>
        <IconBadge icon="plus" />
        <span className="folder-name">New folder</span>
      </Button>
    </nav>
  );
}
