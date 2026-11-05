import type { NoteDraft } from '@/features/editor/NoteDraft';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/button';
import { folderTone } from '@/lib/folder-tone';
import { pathName } from '@/features/storage/storage-paths';
import { useWorkspaceStore } from '@/store/use-workspace-store';

export function EditorHeader({ draft }: { draft: NoteDraft }) {
  const goHome = useWorkspaceStore((state) => state.goHome);
  const updateTitle = useWorkspaceStore((state) => state.updateNoteTitle);
  const saveNote = useWorkspaceStore((state) => state.saveNote);
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
        <span role="status" className="editor-save-status" data-state={draft.status}>
          <Icon name={draft.status === 'retrying' ? 'close' : 'check'} />
          {statusText}
        </span>
      </div>
      <div className="editor-title-row">
        <label htmlFor="note-title" className="sr-only">
          Note title
        </label>
        <input
          id="note-title"
          className="editor-title"
          value={draft.title}
          placeholder="Untitled note"
          disabled={isMutating}
          aria-invalid={draft.error?.code === 'invalid-name'}
          onChange={(event) => updateTitle(draft.identifier, event.target.value)}
          onBlur={() => {
            void saveNote(draft.identifier);
          }}
        />
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
