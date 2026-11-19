import { lazy, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/Icon';
import { SaveStatusIndicator } from '@/components/ui/SaveStatusIndicator';
import { useEditingLocked } from '@/features/editor/use-editing-locked';
import { useWorkspaceStore } from '@/store/use-workspace-store';
import { DiagramNotice } from './DiagramNotice';

const DiagramCanvas = lazy(async () => {
  const module = await import('@/features/diagrams/DiagramCanvas');
  return { default: module.DiagramCanvas };
});

/** The debug-only playground for diagram files; the full diagram screen comes later. */
export function DiagramScreen() {
  const goHome = useWorkspaceStore((state) => state.goHome);
  const diagram = useWorkspaceStore((state) => state.diagram);
  const diagrams = useWorkspaceStore((state) => state.tree.diagrams);
  const openError = useWorkspaceStore((state) => state.diagramOpenError);
  const newDiagram = useWorkspaceStore((state) => state.newDiagram);
  const openDiagramFile = useWorkspaceStore((state) => state.openDiagramFile);
  const trashOpenDiagram = useWorkspaceStore((state) => state.trashOpenDiagram);
  const updateDiagram = useWorkspaceStore((state) => state.updateDiagram);
  const busy = useEditingLocked();
  const elementCount = diagram?.scene.elements.filter((element) => !element.isDeleted).length;

  return (
    <main className="diagram-panel" aria-label="Diagram" aria-busy={busy}>
      <div className="diagram-toolbar">
        <Button
          variant="ghost"
          onClick={() => {
            void goHome();
          }}
        >
          <Icon name="left" />
          Back to home
        </Button>
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => {
            void newDiagram();
          }}
        >
          New diagram
        </Button>
        <select
          aria-label="Open diagram"
          className="diagram-picker"
          disabled={busy || diagrams.length === 0}
          value={diagram?.summary.relativePath ?? ''}
          onChange={(event) => {
            if (event.target.value) void openDiagramFile(event.target.value);
          }}
        >
          <option value="">Open diagram…</option>
          {diagrams.map((item) => (
            <option key={item.relativePath} value={item.relativePath}>
              {item.relativePath}
            </option>
          ))}
        </select>
        {diagram && (
          <>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                void trashOpenDiagram();
              }}
            >
              Delete diagram
            </Button>
            <SaveStatusIndicator status={diagram.status} />
            <span className="diagram-element-count">{elementCount} elements</span>
          </>
        )}
        <p className="diagram-preview-note">Preview: the full diagram screen comes later.</p>
      </div>
      {openError && (
        <div className="editor-notice" role="alert">
          <p>{openError.message}</p>
        </div>
      )}
      {diagram && <DiagramNotice diagram={diagram} />}
      {diagram ? (
        <Suspense
          fallback={
            <p role="status" className="diagram-loading">
              Opening diagram…
            </p>
          }
        >
          <DiagramCanvas
            key={`${diagram.summary.relativePath}:${diagram.documentVersion}`}
            scene={diagram.scene}
            onDocumentChange={updateDiagram}
          />
        </Suspense>
      ) : (
        <p className="diagram-loading">Create a diagram or open one from the vault.</p>
      )}
    </main>
  );
}
