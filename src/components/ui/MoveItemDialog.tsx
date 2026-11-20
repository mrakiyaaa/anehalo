import * as Dialog from '@radix-ui/react-dialog';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import type { RepositoryResult } from '@/features/storage/repository-result';
import { useWorkspaceStore } from '@/store/use-workspace-store';

interface MoveItemDialogProps {
  kind: string;
  name: string;
  folder: string | null;
  onMove: (folder: string | null) => Promise<RepositoryResult<unknown>>;
  onClose: () => void;
}

/** "" stands for the vault root, since a select's values are strings. */
const vaultRoot = '';

export function MoveItemDialog({ kind, name, folder, onMove, onClose }: MoveItemDialogProps) {
  const folders = useWorkspaceStore((state) => state.tree.folders);
  const [destination, setDestination] = useState(folder ?? vaultRoot);
  const [isMoving, setIsMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function move(event: FormEvent) {
    event.preventDefault();
    setIsMoving(true);
    const result = await onMove(destination === vaultRoot ? null : destination);
    setIsMoving(false);
    if (result.ok) onClose();
    else setError(result.error.message);
  }
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !isMoving) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="item-dialog">
          <Dialog.Title>Move {kind}</Dialog.Title>
          <Dialog.Description>Choose a folder for “{name}”.</Dialog.Description>
          <form
            onSubmit={(event) => {
              void move(event);
            }}
          >
            <label className="settings-field">
              Folder
              <select
                value={destination}
                disabled={isMoving}
                onChange={(event) => setDestination(event.target.value)}
              >
                <option value={vaultRoot}>Vault root</option>
                {folders.map((option) => (
                  <option key={option.relativePath} value={option.relativePath}>
                    {option.relativePath}
                  </option>
                ))}
              </select>
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="dialog-buttons">
              <Button type="button" variant="outline" disabled={isMoving} onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isMoving || destination === (folder ?? vaultRoot)}>
                {isMoving ? 'Moving…' : 'Move'}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
