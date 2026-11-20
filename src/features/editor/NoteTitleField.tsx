import type { NoteDraft } from '@/features/editor/NoteDraft';
import { TitleField } from '@/components/ui/TitleField';
import { useWorkspaceStore } from '@/store/use-workspace-store';

export function NoteTitleField({ draft, disabled }: { draft: NoteDraft; disabled: boolean }) {
  const editTitle = useWorkspaceStore((state) => state.editNoteTitle);
  const commitTitle = useWorkspaceStore((state) => state.commitNoteTitle);
  return (
    <TitleField
      id="note-title"
      label="Note title"
      placeholder="Untitled note"
      title={draft.title}
      savedTitle={draft.note.title}
      disabled={disabled}
      invalid={draft.error?.code === 'invalid-name'}
      onType={(text) => editTitle(draft.identifier, text)}
      onCommit={(text) => commitTitle(draft.identifier, text)}
    />
  );
}
