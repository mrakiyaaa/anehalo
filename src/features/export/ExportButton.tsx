import { Download, LoaderCircle } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes } from 'react';

interface ExportButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly subject: 'note' | 'diagram';
  /** The percentage to show while this item is exporting; null when it is not. */
  readonly progress: number | null;
}

/** The Export button in the note and diagram headers; each opens its own menu or popover. */
export const ExportButton = forwardRef<HTMLButtonElement, ExportButtonProps>(function ExportButton(
  { subject, progress, ...props },
  ref,
) {
  const exporting = progress !== null;
  return (
    <button
      ref={ref}
      type="button"
      className="editor-export-button"
      aria-label={exporting ? `Exporting ${subject}` : 'Export'}
      {...props}
    >
      {exporting ? (
        <LoaderCircle className="export-spinner" size={15} aria-hidden="true" />
      ) : (
        <Download size={15} aria-hidden="true" />
      )}
      <span>{exporting ? `${Math.round(progress * 100)}%` : 'Export'}</span>
    </button>
  );
});
