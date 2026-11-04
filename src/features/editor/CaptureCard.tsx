import { useEffect, useState, type RefObject } from 'react';
import { Icon } from '@/components/ui/Icon';

interface CaptureCardProps {
  captureReference: RefObject<HTMLTextAreaElement | null>;
}

export function CaptureCard({ captureReference }: CaptureCardProps) {
  const [draft, setDraft] = useState('');
  const [savedDraft, setSavedDraft] = useState('');
  const isSaving = draft.trim().length > 0 && draft !== savedDraft;
  const statusText = isSaving ? 'Saving…' : draft.trim() ? 'Saved just now' : 'Saved automatically';

  useEffect(() => {
    if (!draft.trim()) return;
    const timeout = window.setTimeout(() => setSavedDraft(draft), 700);
    return () => window.clearTimeout(timeout);
  }, [draft]);

  return (
    <div className="capture-card">
      <label className="sr-only" htmlFor="quick-capture">
        Quick capture
      </label>
      <textarea
        ref={captureReference}
        id="quick-capture"
        rows={3}
        placeholder="Start typing. It saves itself. Type /page to link another note."
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
      <div className="capture-footer">
        <span className="capture-hint">
          <kbd>/page</kbd> link a note
        </span>
        <span className="capture-hint desktop-hint">
          <kbd>/</kbd> text color, size, lists
        </span>
        <span role="status" className="capture-status" data-state={isSaving ? 'saving' : 'saved'}>
          <span className="save-status-icon">
            <Icon name="check" />
          </span>
          <span>{statusText}</span>
        </span>
      </div>
    </div>
  );
}
