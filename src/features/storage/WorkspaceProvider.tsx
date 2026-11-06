import { useState, type PropsWithChildren } from 'react';
import type { NoteRepository } from '@/features/storage/NoteRepository';
import { useVaultLifecycle } from '@/features/storage/use-vault-lifecycle';
import { WorkspaceContext } from '@/store/workspace-context';
import { createWorkspaceStore } from '@/store/workspace-store';
import { useSettingsStore } from '@/features/settings/use-settings-store';
import { ExportProvider } from '@/features/export/ExportProvider';

type WorkspaceProviderProps = PropsWithChildren<{ repository: NoteRepository }>;

export function WorkspaceProvider({ repository, children }: WorkspaceProviderProps) {
  const settings = useSettingsStore((state) => state.settings);
  const rememberNote = useSettingsStore((state) => state.updateLastOpenedNote);
  const [store] = useState(() =>
    createWorkspaceStore(repository, {
      lastOpenedNotePath: settings?.lastOpenedNotePath ?? null,
      reopenLastNote: settings?.reopenLastNote ?? true,
      rememberNote,
    }),
  );
  const flushSettings = useSettingsStore((state) => state.flushPendingSaves);
  useVaultLifecycle(store, flushSettings);
  return (
    <WorkspaceContext.Provider value={store}>
      <ExportProvider repository={repository}>{children}</ExportProvider>
    </WorkspaceContext.Provider>
  );
}
