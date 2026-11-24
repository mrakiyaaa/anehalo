import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { Button } from '@/components/ui/button';
import { formatFileSize } from './import-candidate';

interface LargeImportDialogProps {
  readonly name: string;
  readonly size: number;
  readonly onAnswer: (importAnyway: boolean) => void;
}

/** Asked once per file over 50 MB, before anything is copied. */
export function LargeImportDialog({ name, size, onAnswer }: LargeImportDialogProps) {
  return (
    <AlertDialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onAnswer(false);
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="dialog-overlay" />
        <AlertDialog.Content className="item-dialog">
          <AlertDialog.Title>Import a large file?</AlertDialog.Title>
          <AlertDialog.Description>
            “{name}” is {formatFileSize(size)}. Importing copies all of it into your notes folder
            and may take a while.
          </AlertDialog.Description>
          <div className="dialog-buttons">
            <AlertDialog.Cancel asChild>
              <Button variant="outline">Skip this file</Button>
            </AlertDialog.Cancel>
            <Button
              onClick={() => {
                onAnswer(true);
              }}
            >
              Import anyway
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
