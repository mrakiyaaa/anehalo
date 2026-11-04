import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { RepositoryResult } from '@/features/storage/repository-result';

interface DeleteItemDialogProps {
  kind: 'note' | 'folder';
  name: string;
  onDelete: () => Promise<RepositoryResult<unknown>>;
  onClose: () => void;
}

export function DeleteItemDialog({ kind, name, onDelete, onClose }: DeleteItemDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function moveToTrash() {
    setIsDeleting(true);
    const result = await onDelete();
    setIsDeleting(false);
    if (result.ok) onClose();
    else setError(result.error.message);
  }
  return (
    <AlertDialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !isDeleting) onClose();
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="dialog-overlay" />
        <AlertDialog.Content className="item-dialog">
          <AlertDialog.Title>Move “{name}” to trash?</AlertDialog.Title>
          <AlertDialog.Description>
            {kind === 'folder' ? 'The folder and everything inside it will be moved. ' : ''}You can
            recover it from the .trash directory in your vault.
          </AlertDialog.Description>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="dialog-buttons">
            <AlertDialog.Cancel asChild>
              <Button variant="outline" disabled={isDeleting}>
                Cancel
              </Button>
            </AlertDialog.Cancel>
            <Button
              variant="destructive"
              disabled={isDeleting}
              onClick={() => {
                void moveToTrash();
              }}
            >
              {isDeleting ? 'Moving…' : 'Move to trash'}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
