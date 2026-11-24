import { Icon } from '@/components/ui/Icon';
import { pathName } from '@/features/storage/storage-paths';
import { useWorkspaceStore } from '@/store/use-workspace-store';
import { useDiagramImport } from '@/features/diagram-import/import-context';

export function CaptureCard() {
  const startQuickNote = useWorkspaceStore((state) => state.startQuickNote);
  const folder = useWorkspaceStore((state) => state.activeFolderPath);
  const isMutating = useWorkspaceStore((state) => state.isMutating);
  const vaultReady = useWorkspaceStore((state) => Boolean(state.tree.vaultPath));
  const newDiagram = useWorkspaceStore((state) => state.newDiagram);
  const diagramsAvailable = useWorkspaceStore((state) => state.diagramsAvailable);
  const importer = useDiagramImport();
  return (
    <div className="capture-card">
      <button
        type="button"
        className="capture-start"
        aria-label="Quick capture: Capture a thought. Start a new note."
        disabled={!vaultReady || isMutating}
        onClick={() => {
          void startQuickNote();
        }}
      >
        Capture a thought. Start a new note.
      </button>
      <div className="capture-footer">
        <span className="capture-hint">
          <Icon name="folder" />
          {folder ? pathName(folder) : 'Vault root'}
        </span>
        <span className="capture-hint desktop-hint">Plain Markdown</span>
        <span className="capture-hint">
          <Icon name="pen" />
          Start writing
        </span>
        {diagramsAvailable && (
          <button
            type="button"
            className="capture-action"
            disabled={!vaultReady || isMutating}
            onClick={() => {
              void newDiagram();
            }}
          >
            <Icon name="shapes" />
            New diagram
          </button>
        )}
        {importer && (
          <button
            type="button"
            className="capture-action"
            disabled={!vaultReady || isMutating}
            onClick={() => importer.chooseFiles(folder)}
          >
            <Icon name="import" />
            Import diagram…
          </button>
        )}
      </div>
    </div>
  );
}
