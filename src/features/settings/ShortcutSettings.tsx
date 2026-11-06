import { useEffect } from 'react';
import { useDesktopRuntime } from '@/features/tray/desktop-context';
import { useState } from 'react';
import {
  defaultQuickNoteShortcut,
  shortcutFromEvent,
} from '@/features/shortcuts/shortcut-validation';
import type { ChangeSettings } from './GeneralSettings';

export function ShortcutSettings({
  shortcut,
  change,
}: {
  shortcut: string;
  change: ChangeSettings;
}) {
  const runtime = useDesktopRuntime();
  useEffect(
    () => () => {
      runtime.state.setState({ recordingShortcut: false });
    },
    [runtime],
  );
  const [recording, setRecording] = useState(false);
  return (
    <section className="settings-section" aria-labelledby="shortcut-settings">
      <h3 id="shortcut-settings">Shortcuts</h3>
      <label className="settings-field">
        New quick note
        <span className="settings-inline">
          <input
            readOnly
            data-shortcut-recorder
            aria-label="Record quick note shortcut"
            value={recording ? 'Press a shortcut…' : shortcut}
            onFocus={() => {
              setRecording(true);
              runtime.state.setState({ recordingShortcut: true });
            }}
            onBlur={() => {
              setRecording(false);
              runtime.state.setState({ recordingShortcut: false });
            }}
            onKeyDown={(event) => {
              if (event.key === 'Tab') return;
              event.preventDefault();
              event.stopPropagation();
              if (event.key === 'Escape') {
                setRecording(false);
                event.currentTarget.blur();
                return;
              }
              const recorded = shortcutFromEvent(event.nativeEvent);
              if (recorded) {
                setRecording(false);
                void change({ quickNoteShortcut: recorded });
              }
            }}
          />
          <button
            type="button"
            onClick={() => {
              void change({ quickNoteShortcut: defaultQuickNoteShortcut });
            }}
          >
            Reset
          </button>
        </span>
      </label>
      <p>Focus the field and press a modifier and a key. Works while Anehalo is in the tray.</p>
    </section>
  );
}
