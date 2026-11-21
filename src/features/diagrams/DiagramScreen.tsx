import { lazy, memo, Suspense, useCallback, useEffect, useRef } from 'react';
import type { DiagramCanvasHandle } from './DiagramCanvas';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/Icon';
import { ItemHeader } from '@/components/layout/ItemHeader';
import { useEditingLocked } from '@/features/editor/use-editing-locked';
import { SettingsNotice } from '@/features/settings/SettingsNotice';
import { StorageStatus } from '@/features/storage/StorageStatus';
import { useWorkspaceStore } from '@/store/use-workspace-store';
import { DiagramNotice } from './DiagramNotice';
import { DiagramTitleField } from './DiagramTitleField';
import { BacklinksPanel } from '@/features/note-links/BacklinksPanel';
import { useElementLinkOpener } from './use-element-link-opener';

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
  const openElementLink = useElementLinkOpener();
  const goHome = useWorkspaceStore((state) => state.goHome);
  const busy = useEditingLocked();
  const elementFocus = useWorkspaceStore((state) => state.elementFocus);
  const clearElementFocus = useWorkspaceStore((state) => state.clearElementFocus);
  const canvas = useRef<DiagramCanvasHandle>(null);
  const canvasKey = diagram ? `${diagram.summary.relativePath}:${diagram.documentVersion}` : null;
  // Which canvas has its drawing loaded; a new key means a new, not yet ready canvas.
  const readyCanvas = useRef<string | null>(null);

  const showElementFocus = useCallback(() => {
    if (!elementFocus || !canvasKey || readyCanvas.current !== canvasKey) return;
    if (elementFocus.path !== diagram?.summary.relativePath) return;
    canvas.current?.focusElement(elementFocus.elementId);
    // Shown or no longer in the drawing: either way the request is done.
    clearElementFocus();
  }, [elementFocus, canvasKey, diagram?.summary.relativePath, clearElementFocus]);
  // The latest request and canvas, for the stable ready callback below.
  const latest = useRef({ showElementFocus, canvasKey });
  useEffect(() => {
    latest.current = { showElementFocus, canvasKey };
    showElementFocus();
  }, [showElementFocus, canvasKey]);
  // Stable, so the memoized canvas is not re-rendered when a focus request arrives.
  const handleSceneReady = useCallback(() => {
    readyCanvas.current = latest.current.canvasKey;
    latest.current.showElementFocus();
  }, []);

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
        <BacklinksPanel path={diagram.summary.relativePath} defaultOpen={false} />
      </div>
      <Suspense
        fallback={
          <p role="status" className="diagram-loading">
            Opening diagram...
          </p>
        }
      >
        <DiagramCanvas
          ref={canvas}
          key={canvasKey ?? undefined}
          onSceneReady={handleSceneReady}
          scene={diagram.loadedScene}
          onDocumentChange={updateDiagram}
          onElementLink={openElementLink}
        />
      </Suspense>
    </main>
  );
}
