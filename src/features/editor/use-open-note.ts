import { useWorkspaceStore } from '@/store/use-workspace-store';

export function useOpenNote() {
  const draft = useWorkspaceStore((state) => state.openDraft);
  const isOpening = useWorkspaceStore((state) => state.isOpeningNote);
  const error = useWorkspaceStore((state) => state.openingError);
  return { draft, isOpening, error };
}
