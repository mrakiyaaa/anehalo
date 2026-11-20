import { logFailure } from '@/features/diagnostics/error-logging';
import type { SettingsStore } from './settings-store';

/** The longest the window waits for settings.json before showing with default appearance. */
export const SETTINGS_WAIT_LIMIT_MS = 1_500;

/**
 * Resolves once settings.json has been read (or failed to read), or after the wait limit. The
 * accent and sidebar state are applied as settings load (see preference-sync), so showing the
 * window after this means the first frame is right; if the file is slow (a locked or remote
 * folder), the window shows with the defaults and the real values apply when they arrive.
 */
export function settingsReady(
  store: SettingsStore,
  limitMilliseconds = SETTINGS_WAIT_LIMIT_MS,
): Promise<'loaded' | 'timed-out'> {
  if (!store.getState().isLoading) return Promise.resolve('loaded');
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      unsubscribe();
      logFailure('settings-timeout');
      resolve('timed-out');
    }, limitMilliseconds);
    const unsubscribe = store.subscribe((state) => {
      if (state.isLoading) return;
      clearTimeout(timer);
      unsubscribe();
      resolve('loaded');
    });
  });
}
