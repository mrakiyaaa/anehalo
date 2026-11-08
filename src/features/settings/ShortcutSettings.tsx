import {
  defaultOpenShortcut,
  defaultQuickNoteShortcut,
} from '@/features/shortcuts/shortcut-validation';
import type { ChangeSettings } from './GeneralSettings';
import type { AppSettings } from './AppSettings';
import { ShortcutRecorder } from './ShortcutRecorder';

export function ShortcutSettings({
  settings,
  change,
}: {
  settings: AppSettings;
  change: ChangeSettings;
}) {
  return (
    <section className="settings-section" aria-labelledby="shortcut-settings">
      <h3 id="shortcut-settings">Shortcuts</h3>
      <ShortcutRecorder
        label="New quick note"
        accessibleName="Record quick note shortcut"
        shortcut={settings.quickNoteShortcut}
        defaultShortcut={defaultQuickNoteShortcut}
        change={(shortcut) => change({ quickNoteShortcut: shortcut })}
      />
      <ShortcutRecorder
        label="Open Anehalo"
        accessibleName="Record Open Anehalo shortcut"
        shortcut={settings.openShortcut}
        defaultShortcut={defaultOpenShortcut}
        change={(shortcut) => change({ openShortcut: shortcut })}
      />
      <p>Focus a field and press a modifier and a key. Works while Anehalo is in the tray.</p>
    </section>
  );
}
