import { Button } from '@/components/ui/button';

interface ConflictNoticeProps {
  /** What changed, as the user calls it: "note" or "diagram". */
  readonly subject: string;
  readonly onKeepMine: () => void;
  readonly onLoadTheirs: () => void;
}

/** Shown when a file changed outside Anehalo while it had unsaved changes. */
export function ConflictNotice({ subject, onKeepMine, onLoadTheirs }: ConflictNoticeProps) {
  return (
    <div className="editor-notice" role="alert">
      <p>This {subject} changed outside Anehalo.</p>
      <div className="editor-notice-actions">
        <Button variant="outline" onClick={onKeepMine}>
          Keep mine
        </Button>
        <Button variant="outline" onClick={onLoadTheirs}>
          Load theirs
        </Button>
      </div>
    </div>
  );
}
