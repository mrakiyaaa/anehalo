import { useEffect } from 'react';

type ExportKey = 'c' | 'e' | 's';

/**
 * Ctrl+Shift shortcuts for export, taken before the editor or Excalidraw sees them, so the
 * window has one export path whatever has the focus.
 */
export function useExportKeys(handlers: Partial<Record<ExportKey, () => void>>) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || !event.shiftKey || event.altKey) return;
      const handler = (handlers as Partial<Record<string, () => void>>)[event.key.toLowerCase()];
      if (!handler) return;
      event.preventDefault();
      event.stopPropagation();
      handler();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [handlers]);
}
