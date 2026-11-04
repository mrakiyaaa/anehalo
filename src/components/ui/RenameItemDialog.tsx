import * as Dialog from '@radix-ui/react-dialog';
import { InlineNameForm } from '@/components/ui/InlineNameForm';
import type { RepositoryResult } from '@/features/storage/repository-result';

interface RenameItemDialogProps {
  kind: 'note' | 'folder';
  name: string;
  onRename: (name: string) => Promise<RepositoryResult<unknown>>;
  onClose: () => void;
}

export function RenameItemDialog({ kind, name, onRename, onClose }: RenameItemDialogProps) {
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="item-dialog">
          <Dialog.Title>Rename {kind}</Dialog.Title>
          <Dialog.Description>Choose a name for “{name}”.</Dialog.Description>
          <InlineNameForm
            label={`${kind === 'note' ? 'Note title' : 'Folder name'}`}
            initialValue={name}
            onCancel={onClose}
            onSubmit={async (nextName) => {
              const result = await onRename(nextName);
              if (result.ok) onClose();
              return result;
            }}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
