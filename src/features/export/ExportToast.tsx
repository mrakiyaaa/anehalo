import { Check, ExternalLink, X } from 'lucide-react';

export function ExportToast({
  message,
  error,
  onReveal,
  onDismiss,
}: {
  message: string;
  error?: boolean;
  onReveal?: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="export-toast" role={error ? 'alert' : 'status'} data-error={error || undefined}>
      {!error && <Check size={16} aria-hidden="true" />}
      <span>{message}</span>
      {onReveal && (
        <button type="button" onClick={onReveal}>
          Show in folder <ExternalLink size={13} aria-hidden="true" />
        </button>
      )}
      <button
        type="button"
        className="export-toast-close"
        aria-label="Dismiss export notification"
        onClick={onDismiss}
      >
        <X size={14} />
      </button>
    </div>
  );
}
