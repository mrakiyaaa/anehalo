import { useState, type PropsWithChildren } from 'react';
import type { NoteRepository } from '@/features/storage/NoteRepository';
import { useVaultLifecycle } from '@/features/storage/use-vault-lifecycle';
import { WorkspaceContext } from '@/store/workspace-context';
import { createWorkspaceStore } from '@/store/workspace-store';

type WorkspaceProviderProps = PropsWithChildren<{ repository: NoteRepository }>;

export function WorkspaceProvider({ repository, children }: WorkspaceProviderProps) {
  const [store] = useState(() => createWorkspaceStore(repository));
  useVaultLifecycle(store);
  return <WorkspaceContext.Provider value={store}>{children}</WorkspaceContext.Provider>;
}
