import { useEffect, type RefObject } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/button';
import { pathName } from '@/features/storage/storage-paths';
import { useWorkspaceStore } from '@/store/use-workspace-store';

interface CaptureCardProps {
  captureReference: RefObject<HTMLTextAreaElement | null>;
}

export function CaptureCard({ captureReference }: CaptureCardProps) {
  const capture = useWorkspaceStore((state) => state.capture);
  const updateDraft = useWorkspaceStore((state) => state.updateCaptureDraft);
  const saveCapture = useWorkspaceStore((state) => state.saveCapture);
  const isCreatingNote = useWorkspaceStore((state) => state.isCreatingNote);
  const vaultReady = useWorkspaceStore((state) => Boolean(state.tree.vaultPath));
  useEffect(() => {
    if (
      capture.status === 'error' ||
      capture.draft === capture.savedContent ||
      (!capture.relativePath && !capture.draft.trim())
    )
      return;
    const timeout = window.setTimeout(() => {
      void saveCapture();
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [capture.draft, capture.savedContent, capture.relativePath, capture.status, saveCapture]);
  const statusText =
    capture.status === 'saving'
      ? 'Saving…'
      : capture.status === 'error'
        ? 'Could not save'
        : capture.status === 'saved'
          ? 'Saved just now'
          : 'Ready to capture';
  return (
    <div className="capture-card">
      <label className="sr-only" htmlFor="quick-capture">
        Quick capture
      </label>
      <textarea
        ref={captureReference}
        id="quick-capture"
        rows={3}
        placeholder="Capture a thought. It saves as a Markdown note."
        value={capture.draft}
        disabled={!vaultReady || isCreatingNote}
        onChange={(event) => updateDraft(event.target.value)}
      />
      <div className="capture-footer">
        <span className="capture-hint" title={capture.relativePath ?? undefined}>
          <Icon name="folder" />
          {capture.folder ? pathName(capture.folder) : 'Vault root'}
        </span>
        <span className="capture-hint desktop-hint">Plain Markdown</span>
        <span
          role="status"
          className="capture-status"
          data-state={
            capture.status === 'saving' ? 'saving' : capture.status === 'error' ? 'error' : 'saved'
          }
        >
          <span className="save-status-icon">
            <Icon name={capture.status === 'error' ? 'close' : 'check'} />
          </span>
          <span>{statusText}</span>
        </span>
      </div>
      {capture.error && (
        <div className="capture-error">
          <p className="form-error" role="alert">
            {capture.error.message}
          </p>
          <Button
            variant="outline"
            onClick={() => {
              void saveCapture();
            }}
          >
            Retry save
          </Button>
        </div>
      )}
    </div>
  );
}
