import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { useState } from 'react';
import { useAppServices } from '@/app/app-services';
import { useWorkspaceStore } from '@/store/use-workspace-store';
import { useDesktopRuntime } from '@/features/tray/desktop-context';
import { prepareVaultChange } from './change-vault';
import { chooseVaultLocation } from '@/features/onboarding/choose-vault-location';
import { VaultLocationNotice } from '@/features/onboarding/VaultLocationNotice';

export function NotesFolderSettings({ path }: { path: string }) {
  const services = useAppServices();
  const runtime = useDesktopRuntime();
  const flushNotes = useWorkspaceStore((state) => state.flushNotes);
  const setClosing = useWorkspaceStore((state) => state.setClosing);
  const [chosen, setChosen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function choose() {
    setBusy(true);
    setError(null);
    const result = await chooseVaultLocation(services.folderAccess);
    if (!result.ok) setError(result.error.message);
    else if (result.value && result.value !== path) {
      setChosen(result.value);
    }
    setBusy(false);
  }
  async function switchFolder() {
    if (!chosen) return;
    setBusy(true);
    setClosing(true);
    setError(null);
    try {
      const prepared = await prepareVaultChange(
        chosen,
        services.folderAccess,
        services.createNoteRepository,
        flushNotes,
      );
      if (!prepared.ok) {
        setError(prepared.error.message);
        return;
      }
      const updated = await runtime.updateSettings({ vaultPath: chosen, lastOpenedNotePath: null });
      if (!updated.ok) setError(updated.error.message);
      else setChosen(null);
    } finally {
      setBusy(false);
      setClosing(false);
    }
  }
  return (
    <section className="settings-section" aria-labelledby="folder-settings">
      <h3 id="folder-settings">Notes folder</h3>
      <div className="settings-inline">
        <code className="settings-path">{path}</code>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            void choose();
          }}
        >
          Change
        </button>
      </div>
      <p>Switching folders does not move your files.</p>
      {error && <p role="alert">{error}</p>}
      <AlertDialog.Root
        open={chosen !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setChosen(null);
        }}
      >
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="utility-overlay" />
          <AlertDialog.Content className="vault-confirmation">
            <AlertDialog.Title>Switch notes folder?</AlertDialog.Title>
            <AlertDialog.Description>
              Anehalo will open notes in {chosen}. Your current files will stay in {path}.
            </AlertDialog.Description>
            {chosen && <VaultLocationNotice path={chosen} />}
            {error && <p role="alert">{error}</p>}
            <div className="settings-inline">
              <AlertDialog.Cancel asChild>
                <button type="button" disabled={busy}>
                  Cancel
                </button>
              </AlertDialog.Cancel>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  void switchFolder();
                }}
              >
                {busy ? 'Opening…' : 'Switch folder'}
              </button>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </section>
  );
}
