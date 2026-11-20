import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { useState, type KeyboardEvent } from 'react';
import { Icon } from '@/components/ui/Icon';
import { DiagramThumbnail } from '@/features/thumbnails/DiagramThumbnail';
import { useWorkspaceStore } from '@/store/use-workspace-store';
import { pathName } from '@/features/storage/storage-paths';
import { useDiagramAvailability } from './use-diagram-availability';

/** A read-only preview of a diagram inside a note; activating it opens the diagram. */
export function DiagramEmbedView({ node }: NodeViewProps) {
  const path = String(node.attrs.path ?? '');
  const title = String(node.attrs.title ?? '') || pathName(path).replace(/\.excalidraw$/i, '');
  const availability = useDiagramAvailability(path);
  const openItem = useWorkspaceStore((state) => state.openItem);
  const restoreDiagram = useWorkspaceStore((state) => state.restoreDiagram);
  const reportError = useWorkspaceStore((state) => state.reportError);
  const disabled = useWorkspaceStore((state) => state.isClosing || state.isMutating);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  function open() {
    if (availability.state !== 'present' || disabled) return;
    void openItem(path).then((result) => {
      if (!result.ok) reportError(result.error);
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    open();
  }

  async function restore() {
    const restored = await restoreDiagram(path);
    setRestoreError(restored.ok ? null : restored.error.message);
  }

  return (
    <NodeViewWrapper
      as="figure"
      className="diagram-embed"
      data-state={availability.state}
      contentEditable={false}
      data-drag-handle
    >
      {availability.state === 'present' ? (
        <div
          role="button"
          tabIndex={0}
          className="diagram-embed-open"
          aria-label={`Open diagram ${title}`}
          aria-disabled={disabled || undefined}
          onClick={open}
          onKeyDown={handleKeyDown}
        >
          <DiagramThumbnail diagram={availability.diagram} size="preview" />
        </div>
      ) : (
        <div className="diagram-embed-unavailable" role="status">
          <Icon name="shapes" />
          <span>
            {availability.state === 'trash'
              ? 'Diagram is in trash'
              : availability.state === 'missing'
                ? 'Diagram not found'
                : 'Looking for the diagram…'}
          </span>
          {availability.state === 'trash' && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                void restore();
              }}
            >
              Restore
            </button>
          )}
          {restoreError && <p role="alert">{restoreError}</p>}
        </div>
      )}
      <figcaption>
        <Icon name="shapes" />
        {title}
      </figcaption>
    </NodeViewWrapper>
  );
}
