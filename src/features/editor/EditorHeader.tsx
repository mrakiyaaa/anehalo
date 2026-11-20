import type { NoteDraft } from '@/features/editor/NoteDraft';
import { ItemHeader } from '@/components/layout/ItemHeader';
import { ExportMenu } from '@/features/export/ExportMenu';
import { NoteTitleField } from '@/features/editor/NoteTitleField';
import { useEditingLocked } from '@/features/editor/use-editing-locked';

export function EditorHeader({ draft }: { draft: NoteDraft }) {
  const isMutating = useEditingLocked();
  return (
    <ItemHeader
      status={draft.status}
      folder={draft.note.folder}
      actions={<ExportMenu path={draft.note.relativePath} />}
    >
      {/* Keyed by note so a half-edited title can never carry over to another note. */}
      <NoteTitleField key={draft.identifier} draft={draft} disabled={isMutating} />
    </ItemHeader>
  );
}
