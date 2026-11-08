import { DesktopProvider } from '@/features/tray/DesktopProvider';
import { useState, type PropsWithChildren } from 'react';
import { useStore } from 'zustand';
import type { NoteRepository } from '@/features/storage/NoteRepository';
import { useVaultLifecycle } from '@/features/storage/use-vault-lifecycle';
import { WorkspaceContext } from '@/store/workspace-context';
import { createWorkspaceStore } from '@/store/workspace-store';
import { useSettingsStore } from '@/features/settings/use-settings-store';
import { ExportProvider } from '@/features/export/ExportProvider';
import { VaultRecovery } from './VaultRecovery';
import { TitleBar } from '@/components/layout/TitleBar';

type WorkspaceProviderProps = PropsWithChildren<{
  repository: NoteRepository;
  recovered: () => void;
}>;

export function WorkspaceProvider({ repository, children, recovered }: WorkspaceProviderProps) {
  const settings = useSettingsStore((state) => state.settings);
  const rememberNote = useSettingsStore((state) => state.updateLastOpenedNote);
  const [store] = useState(() =>
    createWorkspaceStore(repository, {
      ...(settings ? { vaultPath: settings.vaultPath } : {}),
      lastOpenedNotePath: settings?.lastOpenedNotePath ?? null,
      reopenLastNote: settings?.reopenLastNote ?? true,
      rememberNote,
    }),
  );
  useVaultLifecycle(store);
  const vaultError = useStore(store, (state) => state.vaultError);
  const loading = useStore(store, (state) => state.isLoading && !state.tree.vaultPath);
  return (
    <WorkspaceContext.Provider value={store}>
      <DesktopProvider store={store}>
        {vaultError ? (
          <VaultRecovery error={vaultError} recovered={recovered} />
        ) : loading ? (
          <div className="onboarding-shell">
            <TitleBar />
            <main className="startup-status" role="status">
              Opening your notes folder…
            </main>
          </div>
        ) : (
          <ExportProvider repository={repository}>{children}</ExportProvider>
        )}
      </DesktopProvider>
    </WorkspaceContext.Provider>
  );
}
