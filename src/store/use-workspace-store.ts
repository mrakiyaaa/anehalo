import { useContext } from 'react';
import { useStore } from 'zustand';
import { WorkspaceContext } from '@/store/workspace-context';
import type { WorkspaceState } from '@/store/workspace-state';

export function useWorkspaceStore<Value>(selector: (state: WorkspaceState) => Value): Value {
  const store = useContext(WorkspaceContext);
  if (!store) throw new Error('The workspace must be rendered inside WorkspaceProvider.');
  return useStore(store, selector);
}
