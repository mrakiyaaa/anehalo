import * as Dialog from '@radix-ui/react-dialog';
import { useState } from 'react';
import { useStore } from 'zustand';
import { useDesktopRuntime } from '@/features/tray/desktop-context';
import { useSettingsStore } from './use-settings-store';
import { GeneralSettings } from './GeneralSettings';
import { ShortcutSettings } from './ShortcutSettings';
import { NotesFolderSettings } from './NotesFolderSettings';
import type { AppSettings } from './AppSettings';
import logo from '@/assets/logo-mark.png';
import packageMetadata from '../../../package.json';

function SettingsContent() {
  const settings = useSettingsStore((state) => state.pendingSettings ?? state.settings);
  const runtime = useDesktopRuntime();
  const [error, setError] = useState<string | null>(null);
  async function change(patch: Partial<AppSettings>) {
    const result = await runtime.updateSettings(patch);
    setError(result.ok ? null : result.error.message);
  }
  if (!settings) return null;
  return (
    <>
      {error && (
        <p role="alert" className="settings-error">
          {error}
        </p>
      )}
      <GeneralSettings settings={settings} change={change} />
      <ShortcutSettings settings={settings} change={change} />
      <NotesFolderSettings path={settings.vaultPath} />
      <section className="settings-section settings-about" aria-labelledby="about-settings">
        <img src={logo} alt="" />
        <div>
          <h3 id="about-settings">About Anehalo</h3>
          <p>Version {packageMetadata.version}</p>
          <p>A quiet place for your thoughts.</p>
        </div>
      </section>
    </>
  );
}

export function SettingsScreen() {
  const runtime = useDesktopRuntime();
  const open = useStore(runtime.state, (state) => state.settingsOpen);
  return (
    <Dialog.Root open={open} onOpenChange={(value) => runtime.openSettings(value)}>
      <Dialog.Portal>
        <Dialog.Overlay className="utility-overlay" />
        <Dialog.Content
          className="settings-dialog"
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            document.querySelector<HTMLElement>('[aria-label="Settings"]')?.focus();
          }}
        >
          <div className="settings-heading">
            <Dialog.Title>Settings</Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" aria-label="Close Settings">
                ×
              </button>
            </Dialog.Close>
          </div>
          <SettingsContent />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
