import { lazy, memo, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/Icon';
import { ItemHeader } from '@/components/layout/ItemHeader';
import { useEditingLocked } from '@/features/editor/use-editing-locked';
import { SettingsNotice } from '@/features/settings/SettingsNotice';
import { StorageStatus } from '@/features/storage/StorageStatus';
import { useWorkspaceStore } from '@/store/use-workspace-store';
import { DiagramNotice } from './DiagramNotice';
import { DiagramTitleField } from './DiagramTitleField';

// Memoized: Excalidraw re-rendering thousands of shapes on every save-status change would
// block the window, and the canvas only reads its scene once anyway.
const DiagramCanvas = lazy(async () => {
  const module = await import('@/features/diagrams/DiagramCanvas');
  return { default: memo(module.DiagramCanvas) };
});

export function DiagramScreen() {
  const diagram = useWorkspaceStore((state) => state.diagram);
  const isOpening = useWorkspaceStore((state) => state.isOpeningDiagram);
  const openError = useWorkspaceStore((state) => state.diagramOpenError);
  const updateDiagram = useWorkspaceStore((state) => state.updateDiagram);
  const goHome = useWorkspaceStore((state) => state.goHome);
  const busy = useEditingLocked();

  if (isOpening || !diagram)
    return (
      <main className="editor-panel editor-loading" aria-label="Diagram" aria-busy={busy}>
        {isOpening ? (
          <p role="status">Opening diagram...</p>
        ) : (
          <>
            <p role="alert">{openError?.message ?? 'This diagram could not be opened.'}</p>
            <Button
              variant="outline"
              onClick={() => {
                void goHome();
              }}
            >
              <Icon name="left" />
              Back to home
            </Button>
          </>
        )}
      </main>
    );
  const elementCount = diagram.scene.elements.filter((element) => !element.isDeleted).length;
  return (
    <main
      className="diagram-panel"
      aria-label="Diagram"
      aria-busy={busy}
      data-element-count={elementCount}
    >
      <div className="diagram-chrome">
        <StorageStatus />
        <SettingsNotice />
        <ItemHeader status={diagram.status} folder={diagram.summary.folder}>
          {/* Keyed by diagram so a half-edited title can never carry over to another one. */}
          <DiagramTitleField key={diagram.identifier} diagram={diagram.summary} disabled={busy} />
        </ItemHeader>
        <DiagramNotice diagram={diagram} />
      </div>
      <Suspense
        fallback={
          <p role="status" className="diagram-loading">
            Opening diagram...
          </p>
        }
      >
        <DiagramCanvas
          key={`${diagram.summary.relativePath}:${diagram.documentVersion}`}
          scene={diagram.loadedScene}
          onDocumentChange={updateDiagram}
        />
      </Suspense>
    </main>
  );
}
