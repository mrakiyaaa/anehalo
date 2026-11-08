import { useEffect, useState } from 'react';
import { useDesktopRuntime } from '@/features/tray/desktop-context';
import { shortcutFromEvent } from '@/features/shortcuts/shortcut-validation';

interface ShortcutRecorderProps {
  label: string;
  accessibleName: string;
  shortcut: string;
  defaultShortcut: string;
  change: (shortcut: string) => Promise<void>;
}

export function ShortcutRecorder({
  label,
  accessibleName,
  shortcut,
  defaultShortcut,
  change,
}: ShortcutRecorderProps) {
  const runtime = useDesktopRuntime();
  const [recording, setRecording] = useState(false);
  useEffect(() => () => runtime.state.setState({ recordingShortcut: false }), [runtime]);
  return (
    <label className="settings-field">
      {label}
      <span className="settings-inline">
        <input
          readOnly
          data-shortcut-recorder
          aria-label={accessibleName}
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
              void change(recorded);
            }
          }}
        />
        <button
          type="button"
          aria-label={`Reset ${label} shortcut`}
          onClick={() => {
            void change(defaultShortcut);
          }}
        >
          Reset
        </button>
      </span>
    </label>
  );
}
