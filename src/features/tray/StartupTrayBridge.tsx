import { useEffect, useState } from 'react';
import { useAppServices } from '@/app/app-services';
import { useSettingsStore } from '@/features/settings/use-settings-store';
import type { RepositoryResult } from '@/features/storage/repository-result';

export function StartupTrayBridge() {
  const { desktop } = useAppServices();
  const completed = useSettingsStore((state) => state.settings?.onboardingCompleted ?? false);
  const flushSettings = useSettingsStore((state) => state.flushPendingSaves);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (completed || !desktop) return;
    let disposed = false;
    let closing = false;
    let disconnect: (() => void) | undefined;
    function accept(result: RepositoryResult<unknown>) {
      if (!result.ok && !disposed) setError(result.error.message);
      return result.ok;
    }
    async function quit() {
      if (!desktop || closing) return;
      closing = true;
      try {
        if (!accept(await flushSettings())) return;
        if (!accept(await desktop.shortcuts.unregister())) return;
        accept(await desktop.tray.quit());
      } finally {
        closing = false;
      }
    }
    const show = () => {
      void desktop.tray.show().then(accept);
    };
    void desktop.tray
      .observe({
        close: () => {
          void quit();
        },
        quit: () => {
          void quit();
        },
        quickNote: show,
        settings: show,
        focus: () => undefined,
      })
      .then((result) => {
        if (result.ok) {
          if (disposed) result.value();
          else disconnect = result.value;
        } else accept(result);
      });
    return () => {
      disposed = true;
      disconnect?.();
    };
  }, [completed, desktop, flushSettings]);
  return !completed && error ? (
    <p role="alert" className="desktop-notice">
      {error}
    </p>
  ) : null;
}
