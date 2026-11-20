import { Icon } from '@/components/ui/Icon';
import type { SaveStatus } from '@/features/storage/autosave/save-timing';

const statusText: Readonly<Record<SaveStatus, string>> = {
  saving: 'Saving...',
  retrying: 'Could not save. Retrying...',
  saved: 'Saved just now',
};

/** The save state of an open note or diagram. */
export function SaveStatusIndicator({ status }: { status: SaveStatus }) {
  return (
    <span role="status" className="editor-save-status" data-state={status}>
      <Icon name={status === 'retrying' ? 'close' : 'check'} />
      {statusText[status]}
    </span>
  );
}
