import { useAppServices } from '@/app/app-services';
import { absoluteVaultPath } from '@/features/storage/storage-paths';
import { useWorkspaceStore } from '@/store/use-workspace-store';

/** Shows a vault item in File Explorer, or null where there is no file manager (tests). */
export function useRevealInFileExplorer(): ((relativePath: string) => void) | null {
  const fileExplorer = useAppServices().desktop?.fileExplorer;
  const vaultPath = useWorkspaceStore((state) => state.tree.vaultPath);
  const reportError = useWorkspaceStore((state) => state.reportError);
  if (!fileExplorer || !vaultPath) return null;
  return (relativePath) => {
    void fileExplorer.reveal(absoluteVaultPath(vaultPath, relativePath)).then((result) => {
      if (!result.ok) reportError(result.error);
    });
  };
}
