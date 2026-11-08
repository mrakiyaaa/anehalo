import { useContext, useEffect, useMemo, useState } from 'react';
import { useAppServices } from '@/app/app-services';
import { useSettingsStore } from '@/features/settings/use-settings-store';
import type { RepositoryResult } from '@/features/storage/repository-result';
import { WindowVisibilityController } from '@/features/window/WindowVisibilityController';
import { parseCommandLineArguments } from '@/features/launch/command-line-arguments';
import { SettingsContext } from '@/features/settings/settings-context';

export function StartupTrayBridge() {
  const { desktop } = useAppServices();
  const completed = useSettingsStore((state) => state.settings?.onboardingCompleted ?? false);
  const flushSettings = useSettingsStore((state) => state.flushPendingSaves);
  const settings = useContext(SettingsContext);
  const [error, setError] = useState<string | null>(null);
  const visibility = useMemo(
    () =>
      desktop && settings
        ? new WindowVisibilityController(desktop.tray, {
            keepRunningInTray: () => settings.getState().settings?.keepRunningInTray ?? true,
            hasOpenEditor: () => false,
            flushPendingSaves: () => settings.getState().flushPendingSaves(),
          })
        : null,
    [desktop, settings],
  );

  useEffect(() => {
    if (!desktop || !visibility) return;
    let disposed = false;
    void desktop.tray.initialArguments().then(async (result) => {
      if (disposed) return;
      const action = result.ok ? parseCommandLineArguments(result.value) : result;
      if (!action.ok) setError(action.error.message);
      if (!action.ok || action.value !== 'background') {
        const shown = await visibility.show();
        if (!shown.ok && !disposed) setError(shown.error.message);
      }
    });
    return () => {
      disposed = true;
    };
  }, [desktop, visibility]);

  useEffect(() => {
    if (completed || !desktop || !visibility) return;
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
        if (!accept(await desktop.shortcuts.unregister(undefined, 'open'))) return;
        accept(await desktop.tray.quit());
      } finally {
        closing = false;
      }
    }
    const show = () => {
      void visibility.show().then(accept);
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
        open: show,
        toggle: () => {
          void visibility.toggle('tray').then(accept);
        },
        error: (failure) => {
          if (!disposed) setError(failure.message);
        },
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
  }, [completed, desktop, flushSettings, visibility]);
  return !completed && error ? (
    <p role="alert" className="desktop-notice">
      {error}
    </p>
  ) : null;
}
