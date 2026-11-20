import { formatVaultCounts } from '@/features/storage/vault-counts';
import { useWorkspaceStore } from '@/store/use-workspace-store';

export function StatusBar() {
  const tree = useWorkspaceStore((state) => state.tree);
  return (
    <footer className="app-statusbar">
      <span>{formatVaultCounts(tree)}</span>
      <span>Stored as .md and .excalidraw files</span>
    </footer>
  );
}
