import type { VaultItem } from '@/features/storage/vault-items';
import type { RepositoryResult } from '@/features/storage/repository-result';
import { useWorkspaceStore } from '@/store/use-workspace-store';

export interface ItemActions {
  readonly open: () => void;
  readonly rename: (name: string) => Promise<RepositoryResult<unknown>>;
  /** Diagrams only: moving a note would need its links rewritten. */
  readonly move?: (folder: string | null) => Promise<RepositoryResult<unknown>>;
  readonly remove: () => Promise<RepositoryResult<unknown>>;
}

/** What the sidebar and Home cards can do with a note or diagram, so both offer the same. */
export function useItemActions(item: VaultItem): ItemActions {
  const openNote = useWorkspaceStore((state) => state.openNote);
  const openDiagram = useWorkspaceStore((state) => state.openDiagramFile);
  const renameNote = useWorkspaceStore((state) => state.renameNote);
  const deleteNote = useWorkspaceStore((state) => state.deleteNote);
  const renameDiagram = useWorkspaceStore((state) => state.renameDiagram);
  const moveDiagram = useWorkspaceStore((state) => state.moveDiagram);
  const trashDiagram = useWorkspaceStore((state) => state.trashDiagram);
  const path = item.relativePath;
  if (item.kind === 'diagram')
    return {
      open: () => {
        void openDiagram(path);
      },
      rename: (name) => renameDiagram(path, name),
      move: (folder) => moveDiagram(path, folder),
      remove: () => trashDiagram(path),
    };
  return {
    open: () => {
      void openNote(path);
    },
    rename: (name) => renameNote(path, name),
    remove: () => deleteNote(path),
  };
}
