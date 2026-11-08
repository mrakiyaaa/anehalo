import { useState } from 'react';
import { TitleBar } from '@/components/layout/TitleBar';
import { useAppServices } from '@/app/app-services';
import { useSettingsStore } from '@/features/settings/use-settings-store';
import { useDesktopRuntime } from '@/features/tray/desktop-context';
import { useWorkspaceStore } from '@/store/use-workspace-store';
import { chooseVaultLocation } from '@/features/onboarding/choose-vault-location';
import { VaultLocationNotice } from '@/features/onboarding/VaultLocationNotice';
import { prepareVaultChange } from '@/features/settings/change-vault';
import type { RepositoryError } from './repository-result';

export function VaultRecovery({
  error,
  recovered,
}: {
  error: RepositoryError;
  recovered: () => void;
}) {
  const services = useAppServices();
  const runtime = useDesktopRuntime();
  const defaultPath = useSettingsStore((state) => state.defaults?.vaultPath);
  const savedPath = useSettingsStore((state) => state.settings?.vaultPath);
  const flushNotes = useWorkspaceStore((state) => state.flushNotes);
  const [chosen, setChosen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function choose() {
    setBusy(true);
    setFailure(null);
    const result = await chooseVaultLocation(services.folderAccess);
    if (!result.ok) setFailure(result.error.message);
    else setChosen(result.value);
    setBusy(false);
  }

  async function open(path: string) {
    setBusy(true);
    setFailure(null);
    try {
      const prepared = await prepareVaultChange(
        path,
        services.folderAccess,
        services.createNoteRepository,
        flushNotes,
      );
      if (!prepared.ok) {
        setFailure(prepared.error.message);
        return;
      }
      const saved = await runtime.updateSettings({ vaultPath: path, lastOpenedNotePath: null });
      if (!saved.ok) {
        setFailure(saved.error.message);
        return;
      }
      recovered();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="onboarding-shell">
      <TitleBar />
      <main className="startup-status" aria-busy={busy}>
        <h1>We couldn't open your notes folder</h1>
        <p role="alert">{failure ?? error.message}</p>
        <p>Your existing files have not been moved or deleted.</p>
        <p>
          Saved location: <code>{savedPath || 'No folder location saved'}</code>
        </p>
        <p>To restore existing notes, choose an Anehalo folder containing them.</p>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            void choose();
          }}
        >
          Choose a folder again
        </button>
        {defaultPath && (
          <>
            <VaultLocationNotice path={defaultPath} />
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                void open(defaultPath);
              }}
            >
              Use the default folder
            </button>
          </>
        )}
        {chosen && (
          <>
            <VaultLocationNotice path={chosen} />
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                void open(chosen);
              }}
            >
              Use this folder
            </button>
          </>
        )}
      </main>
    </div>
  );
}
