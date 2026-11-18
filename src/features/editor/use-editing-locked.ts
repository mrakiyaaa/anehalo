import { useWorkspaceStore } from '@/store/use-workspace-store';

/** Editing pauses while a workspace change runs or the window is closing, so edits cannot race them. */
export function useEditingLocked(): boolean {
  return useWorkspaceStore((state) => state.isMutating || state.isClosing);
}
