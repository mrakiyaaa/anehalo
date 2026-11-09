import type { AppSettings, ThemePreference } from './AppSettings';
import { limitUserName, maximumUserNameLength } from './AppSettings';

export type ChangeSettings = (patch: Partial<AppSettings>) => Promise<void>;

export function SettingsToggle({
  label,
  checked,
  change,
}: {
  label: string;
  checked: boolean;
  change: (value: boolean) => void;
}) {
  return (
    <label className="settings-toggle">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => change(event.target.checked)} />
    </label>
  );
}

export function GeneralSettings({
  settings,
  change,
}: {
  settings: AppSettings;
  change: ChangeSettings;
}) {
  return (
    <section className="settings-section" aria-labelledby="general-settings">
      <h3 id="general-settings">General</h3>
      <label className="settings-field">
        Your name
        <input
          defaultValue={settings.userName}
          maxLength={maximumUserNameLength}
          onChange={(event) => {
            void change({ userName: limitUserName(event.target.value) });
          }}
        />
      </label>
      <label className="settings-field">
        Theme
        <select
          value={settings.theme}
          onChange={(event) => {
            void change({ theme: event.target.value as ThemePreference });
          }}
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="system">Match my PC</option>
        </select>
      </label>
      <SettingsToggle
        label="Reopen last note on launch"
        checked={settings.reopenLastNote}
        change={(reopenLastNote) => {
          void change({ reopenLastNote });
        }}
      />
      <SettingsToggle
        label="Keep running in the tray when I close the window"
        checked={settings.keepRunningInTray}
        change={(keepRunningInTray) => {
          void change({ keepRunningInTray });
        }}
      />
      <SettingsToggle
        label="Start with Windows"
        checked={settings.startWithWindows}
        change={(startWithWindows) => {
          void change({ startWithWindows });
        }}
      />
    </section>
  );
}
