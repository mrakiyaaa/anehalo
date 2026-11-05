import { useState, type PropsWithChildren } from 'react';
import type { NoteRepository } from '@/features/storage/NoteRepository';
import { useVaultLifecycle } from '@/features/storage/use-vault-lifecycle';
import { WorkspaceContext } from '@/store/workspace-context';
import { createWorkspaceStore } from '@/store/workspace-store';
import { useSettingsStore } from '@/features/settings/use-settings-store';

type WorkspaceProviderProps = PropsWithChildren<{ repository: NoteRepository }>;

export function WorkspaceProvider({ repository, children }: WorkspaceProviderProps) {
  const [store] = useState(() => createWorkspaceStore(repository));
  const flushSettings = useSettingsStore((state) => state.flushPendingSaves);
  useVaultLifecycle(store, flushSettings);
  return <WorkspaceContext.Provider value={store}>{children}</WorkspaceContext.Provider>;
}
