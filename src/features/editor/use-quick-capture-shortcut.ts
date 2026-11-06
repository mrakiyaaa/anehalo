import { useAppServices } from '@/app/app-services';
import { useSettingsStore } from '@/features/settings/use-settings-store';
import { shortcutFromEvent } from '@/features/shortcuts/shortcut-validation';
import { useEffect } from 'react';

export function useQuickCaptureShortcut(onQuickNote: () => Promise<void>) {
  const services = useAppServices();
  const shortcut = useSettingsStore((state) => state.settings?.quickNoteShortcut);
  useEffect(() => {
    if (services.desktop) return;
    const focusCapture = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.matches('[data-shortcut-recorder]'))
        return;
      if (shortcutFromEvent(event) === shortcut && !event.repeat) {
        event.preventDefault();
        void onQuickNote();
      }
    };
    window.addEventListener('keydown', focusCapture);
    return () => window.removeEventListener('keydown', focusCapture);
  }, [onQuickNote, services, shortcut]);
}
