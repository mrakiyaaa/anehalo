import { IconBadge } from '@/components/ui/IconBadge';
import { mockWorkspace } from '@/lib/mock-data';

export function StoragePathCard() {
  return (
    <div className="storage-path-card">
      <IconBadge icon="folder" tone="mint" />
      <span>
        Saved on this PC<strong>{mockWorkspace.storagePath}</strong>
      </span>
    </div>
  );
}
