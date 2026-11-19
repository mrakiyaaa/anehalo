import { Button } from '@/components/ui/button';
import { ConflictNotice } from '@/components/ui/ConflictNotice';
import { useWorkspaceStore } from '@/store/use-workspace-store';
import type { DiagramDraft } from './DiagramAutoSaver';

/** Conflict, missing-file and failed-save messages for the open diagram, as for notes. */
export function DiagramNotice({ diagram }: { diagram: DiagramDraft }) {
  const resolveConflict = useWorkspaceStore((state) => state.resolveDiagramConflict);
  const saveDiagram = useWorkspaceStore((state) => state.saveDiagram);
  const checkOpenDiagram = useWorkspaceStore((state) => state.checkOpenDiagram);
  if (diagram.hasExternalChange)
    return (
      <ConflictNotice
        subject="diagram"
        onKeepMine={() => {
          void resolveConflict('mine');
        }}
        onLoadTheirs={() => {
          void resolveConflict('theirs');
        }}
      />
    );
  if (diagram.isMissing)
    return (
      <div className="editor-notice" role="alert">
        <p>
          This diagram was deleted or renamed outside Anehalo.
          {diagram.dirty ? ' Your drawing is kept in memory.' : ''}
        </p>
        <Button
          variant="ghost"
          onClick={() => {
            void checkOpenDiagram();
          }}
        >
          Check again
        </Button>
      </div>
    );
  if (!diagram.error) return null;
  return (
    <div className="editor-notice" role="alert">
      <p>{diagram.error.message}</p>
      <Button
        variant="outline"
        onClick={() => {
          void saveDiagram();
        }}
      >
        Retry save
      </Button>
    </div>
  );
}
