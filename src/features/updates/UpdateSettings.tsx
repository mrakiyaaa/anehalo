import { useStore } from 'zustand';
import type { AppSettings } from '@/features/settings/AppSettings';
import { SettingsToggle, type ChangeSettings } from '@/features/settings/GeneralSettings';
import { useDesktopRuntime } from '@/features/tray/desktop-context';

export function UpdateSettings({
  settings,
  change,
}: {
  settings: AppSettings;
  change: ChangeSettings;
}) {
  const { updates } = useDesktopRuntime();
  const { supported, status, manualCheck, currentVersion } = useStore(updates.state);
  const working = status.kind === 'downloading' || status.kind === 'installing';
  let message: string | null = null;
  if (supported === false) message = 'Updates are turned off in development builds.';
  else if (working) message = 'Updating Anehalo…';
  else if (status.kind === 'available' || status.kind === 'error')
    message = status.kind === 'error' ? status.message : `Anehalo ${status.version} is available.`;
  else if (manualCheck === 'checking') message = 'Checking for updates…';
  else if (manualCheck === 'up-to-date')
    message = `You're up to date${currentVersion ? ` (${currentVersion})` : ''}.`;
  else if (manualCheck === 'failed')
    message = "Couldn't check for updates. Check your internet connection and try again.";
  return (
    <section className="settings-section" aria-labelledby="update-settings">
      <h3 id="update-settings">Updates</h3>
      <SettingsToggle
        label="Automatically check for updates"
        checked={settings.autoCheckForUpdates}
        change={(autoCheckForUpdates) => {
          void change({ autoCheckForUpdates });
        }}
      />
      <div className="settings-inline update-check">
        <button
          type="button"
          disabled={supported !== true || working || manualCheck === 'checking'}
          onClick={() => {
            void updates.checkNow();
          }}
        >
          Check for updates
        </button>
        {(status.kind === 'available' || status.kind === 'error') && (
          <button
            type="button"
            onClick={() => {
              void updates.installNow();
            }}
          >
            {status.kind === 'error' ? 'Try again' : 'Update now'}
          </button>
        )}
      </div>
      {message && <p role={status.kind === 'error' ? 'alert' : 'status'}>{message}</p>}
    </section>
  );
}
