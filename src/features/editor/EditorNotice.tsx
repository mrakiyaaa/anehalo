import { Button } from '@/components/ui/button';
import type { NoteDraft } from '@/features/editor/NoteDraft';
import { useWorkspaceStore } from '@/store/use-workspace-store';

export function EditorNotice({ draft }: { draft: NoteDraft }) {
  const resolveConflict = useWorkspaceStore((state) => state.resolveConflict);
  const checkOpenNote = useWorkspaceStore((state) => state.checkOpenNote);
  const saveNote = useWorkspaceStore((state) => state.saveNote);
  const goHome = useWorkspaceStore((state) => state.goHome);
  const recoverNote = useWorkspaceStore((state) => state.recoverNote);
  if (draft.externalNote)
    return (
      <div className="editor-notice" role="alert">
        <p>This note changed outside Anehalo.</p>
        <div className="editor-notice-actions">
          <Button
            variant="outline"
            onClick={() => {
              void resolveConflict('mine');
            }}
          >
            Keep mine
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              void resolveConflict('theirs');
            }}
          >
            Load theirs
          </Button>
        </div>
      </div>
    );
  if (draft.isMissing)
    return (
      <div className="editor-notice" role="alert">
        <p>
          This note was deleted or renamed outside Anehalo.
          {draft.dirty ? ' Your unsaved text is kept in memory.' : ''}
        </p>
        <div className="editor-notice-actions">
          {draft.dirty && (
            <Button
              variant="outline"
              onClick={() => {
                void recoverNote();
              }}
            >
              Save as new note
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => {
              void goHome();
            }}
          >
            Back to home
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              void checkOpenNote();
            }}
          >
            Check again
          </Button>
        </div>
      </div>
    );
  if (!draft.error) return null;
  return (
    <div className="editor-notice" role="alert">
      <p>{draft.error.message}</p>
      <Button
        variant="outline"
        onClick={() => {
          void saveNote(draft.identifier);
        }}
      >
        Retry save
      </Button>
    </div>
  );
}
