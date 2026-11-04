import { Button } from '@/components/ui/button';
import { useWorkspaceStore } from '@/store/use-workspace-store';

export function StorageStatus() {
  const error = useWorkspaceStore((state) => state.error);
  const isLoading = useWorkspaceStore((state) => state.isLoading);
  const refresh = useWorkspaceStore((state) => state.refreshTree);
  const dismissError = useWorkspaceStore((state) => state.dismissError);
  if (!error) return null;
  return (
    <div className="storage-error" role="alert">
      <p>{error.message}</p>
      <div className="dialog-buttons">
        <Button
          variant="outline"
          disabled={isLoading}
          onClick={() => {
            dismissError();
            void refresh();
          }}
        >
          Reload vault
        </Button>
        <Button variant="ghost" onClick={dismissError}>
          Dismiss
        </Button>
      </div>
    </div>
  );
}
