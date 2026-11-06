import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import * as Popover from '@radix-ui/react-popover';
import { FileText } from 'lucide-react';
import { useState } from 'react';
import { useWorkspaceStore } from '@/store/use-workspace-store';
import { folderTone } from '@/lib/folder-tone';
import { parentPath } from '@/features/storage/storage-paths';

export function NoteLinkView({
  node,
  editor,
  getPos,
  deleteNode,
  updateAttributes,
}: NodeViewProps) {
  const path = String(node.attrs.path ?? '');
  const label = String(node.attrs.label ?? '');
  const note = useWorkspaceStore((state) =>
    state.tree.notes.find((item) => item.relativePath === path),
  );
  const openNote = useWorkspaceStore((state) => state.openNote);
  const restoreLinkedNote = useWorkspaceStore((state) => state.restoreLinkedNote);
  const reportError = useWorkspaceStore((state) => state.reportError);
  const disabled = useWorkspaceStore((state) => state.isClosing || state.isMutating);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function recreate() {
    const result = await restoreLinkedNote(path);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    if (!editor.isDestroyed && getPos() !== undefined)
      updateAttributes({ path: result.value.relativePath });
    setOpen(false);
  }
  return (
    <NodeViewWrapper as="span" className="note-link-wrapper" contentEditable={false}>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            className={`note-link-chip tone-${folderTone(note?.folder ?? parentPath(path))}`}
            data-broken={!note || undefined}
            disabled={disabled}
            title={note ? path : `Missing note: ${path}`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={(event) => {
              if (note) {
                event.preventDefault();
                void openNote(path).then((result) => {
                  if (!result.ok) reportError(result.error);
                });
              }
            }}
          >
            <FileText aria-hidden="true" size={13} />
            <span>{label || note?.title || 'Untitled note'}</span>
          </button>
        </Popover.Trigger>
        {!note && (
          <Popover.Portal>
            <Popover.Content
              className="editor-popover broken-note-popover"
              sideOffset={8}
              collisionPadding={12}
            >
              <p>This note is no longer in your vault.</p>
              {error && <p role="alert">{error}</p>}
              <div>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    void recreate();
                  }}
                >
                  Create it again
                </button>
                <button type="button" disabled={disabled} onClick={deleteNode}>
                  Remove link
                </button>
              </div>
            </Popover.Content>
          </Popover.Portal>
        )}
      </Popover.Root>
    </NodeViewWrapper>
  );
}
