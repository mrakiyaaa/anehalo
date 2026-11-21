import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import * as Popover from '@radix-ui/react-popover';
import { FileText } from 'lucide-react';
import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useWorkspaceStore } from '@/store/use-workspace-store';
import { folderTone } from '@/lib/folder-tone';
import { parentPath } from '@/features/storage/storage-paths';
import { itemKind } from '@/features/storage/vault-items';
import { useDiagramAvailability } from './use-diagram-availability';

interface BrokenLinkPopoverProps {
  readonly message: string;
  readonly actionLabel: string | null;
  readonly error: string | null;
  readonly disabled: boolean;
  readonly onAction: () => void;
  readonly onRemove: () => void;
}

function BrokenLinkPopover({
  message,
  actionLabel,
  error,
  disabled,
  onAction,
  onRemove,
}: BrokenLinkPopoverProps) {
  return (
    <Popover.Portal>
      <Popover.Content
        className="editor-popover broken-note-popover"
        sideOffset={8}
        collisionPadding={12}
      >
        <p>{message}</p>
        {error && <p role="alert">{error}</p>}
        <div>
          {actionLabel && (
            <button type="button" disabled={disabled} onClick={onAction}>
              {actionLabel}
            </button>
          )}
          <button type="button" disabled={disabled} onClick={onRemove}>
            Remove link
          </button>
        </div>
      </Popover.Content>
    </Popover.Portal>
  );
}

/** A link chip to a note or a diagram; a missing target offers to bring it back. */
export function NoteLinkView({
  node,
  editor,
  getPos,
  deleteNode,
  updateAttributes,
}: NodeViewProps) {
  const path = String(node.attrs.path ?? '');
  const label = String(node.attrs.label ?? '');
  const isDiagram = itemKind(path) === 'diagram';
  const note = useWorkspaceStore((state) =>
    isDiagram ? undefined : state.tree.notes.find((item) => item.relativePath === path),
  );
  const diagram = useDiagramAvailability(isDiagram ? path : '');
  const openItem = useWorkspaceStore((state) => state.openItem);
  const restoreLinkedNote = useWorkspaceStore((state) => state.restoreLinkedNote);
  const restoreDiagram = useWorkspaceStore((state) => state.restoreDiagram);
  const reportError = useWorkspaceStore((state) => state.reportError);
  const disabled = useWorkspaceStore((state) => state.isClosing || state.isMutating);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const present = isDiagram ? diagram.state === 'present' : Boolean(note);
  const folder = isDiagram
    ? diagram.state === 'present'
      ? diagram.diagram.folder
      : parentPath(path)
    : (note?.folder ?? parentPath(path));
  const title =
    label ||
    (isDiagram ? (diagram.state === 'present' ? diagram.diagram.title : '') : note?.title) ||
    (isDiagram ? 'Untitled diagram' : 'Untitled note');

  async function recreateNote() {
    const result = await restoreLinkedNote(path);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    if (!editor.isDestroyed && getPos() !== undefined)
      updateAttributes({ path: result.value.relativePath });
    setOpen(false);
  }

  async function restoreFromTrash() {
    const result = await restoreDiagram(path);
    if (!result.ok) setError(result.error.message);
    else setOpen(false);
  }

  return (
    <NodeViewWrapper as="span" className="note-link-wrapper" contentEditable={false}>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            className={`note-link-chip tone-${folderTone(folder)}`}
            data-broken={!present || undefined}
            data-kind={isDiagram ? 'diagram' : 'note'}
            disabled={disabled}
            title={present ? path : `Missing ${isDiagram ? 'diagram' : 'note'}: ${path}`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={(event) => {
              if (present) {
                event.preventDefault();
                void openItem(path).then((result) => {
                  if (!result.ok) reportError(result.error);
                });
              }
            }}
          >
            {isDiagram ? <Icon name="shapes" /> : <FileText aria-hidden="true" size={13} />}
            <span>{title}</span>
          </button>
        </Popover.Trigger>
        {!present &&
          (isDiagram ? (
            <BrokenLinkPopover
              message={
                diagram.state === 'trash'
                  ? 'This diagram is in the trash.'
                  : 'This diagram is no longer in your vault.'
              }
              actionLabel={diagram.state === 'trash' ? 'Restore' : null}
              error={error}
              disabled={disabled}
              onAction={() => {
                void restoreFromTrash();
              }}
              onRemove={deleteNode}
            />
          ) : (
            <BrokenLinkPopover
              message="This note is no longer in your vault."
              actionLabel="Create it again"
              error={error}
              disabled={disabled}
              onAction={() => {
                void recreateNote();
              }}
              onRemove={deleteNode}
            />
          ))}
      </Popover.Root>
    </NodeViewWrapper>
  );
}
