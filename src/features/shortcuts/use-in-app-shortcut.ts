import { useAppServices } from '@/app/app-services';
import { shortcutFromEvent } from '@/features/shortcuts/shortcut-validation';
import { isTypingInDiagramText } from '@/features/shortcuts/typing-target';
import { useEffect } from 'react';

/**
 * Runs a configurable shortcut inside the window when there is no desktop shell to register
 * it globally (the browser preview and component tests).
 */
export function useInAppShortcut(shortcut: string | undefined, action: () => Promise<unknown>) {
  const services = useAppServices();
  useEffect(() => {
    if (services.desktop || !shortcut) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.matches('[data-shortcut-recorder]'))
        return;
      if (isTypingInDiagramText(event.target)) return;
      if (shortcutFromEvent(event) === shortcut && !event.repeat) {
        event.preventDefault();
        void action();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [action, services, shortcut]);
}
