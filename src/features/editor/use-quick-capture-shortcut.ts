import { useEffect } from 'react';

export function useQuickCaptureShortcut(onQuickNote: () => Promise<void>) {
  useEffect(() => {
    const focusCapture = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.altKey && !event.metaKey && event.code === 'KeyN') {
        event.preventDefault();
        void onQuickNote();
      }
    };
    window.addEventListener('keydown', focusCapture);
    return () => window.removeEventListener('keydown', focusCapture);
  }, [onQuickNote]);
}
