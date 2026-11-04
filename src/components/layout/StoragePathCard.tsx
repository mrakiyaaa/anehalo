import { IconBadge } from '@/components/ui/IconBadge';
import { useWorkspaceStore } from '@/store/use-workspace-store';

export function StoragePathCard() {
  const vaultPath = useWorkspaceStore((state) => state.tree.vaultPath);
  return (
    <div className="storage-path-card">
      <IconBadge icon="folder" tone="mint" />
      <span>
        Saved on this PC<strong title={vaultPath}>{vaultPath || 'Opening your vault…'}</strong>
      </span>
    </div>
  );
}
