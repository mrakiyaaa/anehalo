import type { NoteDraft } from '@/features/editor/NoteDraft';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/button';
import { folderTone } from '@/lib/folder-tone';
import { pathName } from '@/features/storage/storage-paths';
import { useWorkspaceStore } from '@/store/use-workspace-store';
import { NoteNavigation } from '@/features/note-links/NoteNavigation';
import { ExportMenu } from '@/features/export/ExportMenu';
import { NoteTitleField } from '@/features/editor/NoteTitleField';

export function EditorHeader({ draft }: { draft: NoteDraft }) {
  const goHome = useWorkspaceStore((state) => state.goHome);
  const isMutating = useWorkspaceStore((state) => state.isMutating || state.isClosing);
  const statusText =
    draft.status === 'saving'
      ? 'Saving...'
      : draft.status === 'retrying'
        ? 'Could not save. Retrying...'
        : 'Saved just now';
  return (
    <header className="editor-header">
      <div className="editor-navigation">
        <div className="editor-navigation-buttons">
          <NoteNavigation />
          <Button
            variant="ghost"
            className="editor-back"
            disabled={isMutating}
            onClick={() => {
              void goHome();
            }}
          >
            <Icon name="left" />
            Home
          </Button>
        </div>
        <div className="editor-export-actions">
          <span role="status" className="editor-save-status" data-state={draft.status}>
            <Icon name={draft.status === 'retrying' ? 'close' : 'check'} />
            {statusText}
          </span>
          <ExportMenu path={draft.note.relativePath} />
        </div>
      </div>
      <div className="editor-title-row">
        <label htmlFor="note-title" className="sr-only">
          Note title
        </label>
        {/* Keyed by note so a half-edited title can never carry over to another note. */}
        <NoteTitleField key={draft.identifier} draft={draft} disabled={isMutating} />
      </div>
      <span
        className={`editor-folder-chip tone-${folderTone(draft.note.folder)}`}
        title={draft.note.folder ?? 'Vault root'}
      >
        <Icon name="folder" />
        {draft.note.folder ? pathName(draft.note.folder) : 'Vault root'}
      </span>
    </header>
  );
}
