import { useEffect, type RefObject } from 'react';

export function useQuickCaptureShortcut(captureReference: RefObject<HTMLTextAreaElement | null>) {
  useEffect(() => {
    const focusCapture = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.altKey && !event.metaKey && event.code === 'KeyN') {
        event.preventDefault();
        captureReference.current?.focus();
      }
    };
    window.addEventListener('keydown', focusCapture);
    return () => window.removeEventListener('keydown', focusCapture);
  }, [captureReference]);
}
