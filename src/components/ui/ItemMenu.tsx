import * as ContextMenu from '@radix-ui/react-context-menu';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useState, type PropsWithChildren } from 'react';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/Icon';
import { DeleteItemDialog } from '@/components/ui/DeleteItemDialog';
import { MoveItemDialog } from '@/components/ui/MoveItemDialog';
import { RenameItemDialog } from '@/components/ui/RenameItemDialog';
import type { RepositoryResult } from '@/features/storage/repository-result';
import { useRevealInFileExplorer } from '@/features/storage/use-reveal-in-file-explorer';
import { useWorkspaceStore } from '@/store/use-workspace-store';
import { ExportMenuItems } from '@/features/export/ExportMenu';

export type MenuItemKind = 'note' | 'diagram' | 'folder';

interface MenuActions {
  readonly kind: MenuItemKind;
  readonly path: string | undefined;
  readonly disabled: boolean;
  readonly onOpen: (() => void) | undefined;
  readonly onNewDiagram: (() => void) | undefined;
  readonly onRename: () => void;
  readonly onMove: (() => void) | undefined;
  readonly onReveal: (() => void) | undefined;
  readonly onDelete: () => void;
}

function MenuItems({
  variant,
  kind,
  path,
  disabled,
  onOpen,
  onNewDiagram,
  onRename,
  onMove,
  onReveal,
  onDelete,
}: MenuActions & { variant: 'context' | 'dropdown' }) {
  const Item = variant === 'context' ? ContextMenu.Item : DropdownMenu.Item;
  return (
    <>
      {onOpen && (
        <Item className="item-menu-option" disabled={disabled} onSelect={onOpen}>
          <Icon name="right" />
          Open
        </Item>
      )}
      {onNewDiagram && (
        <Item className="item-menu-option" disabled={disabled} onSelect={onNewDiagram}>
          <Icon name="shapes" />
          New diagram here
        </Item>
      )}
      <Item className="item-menu-option" disabled={disabled} onSelect={onRename}>
        <Icon name="pen" />
        Rename
      </Item>
      {onMove && (
        <Item className="item-menu-option" disabled={disabled} onSelect={onMove}>
          <Icon name="folder" />
          Move…
        </Item>
      )}
      {kind === 'note' && path && <ExportMenuItems path={path} variant={variant} />}
      {onReveal && (
        <Item className="item-menu-option" onSelect={onReveal}>
          <Icon name="search" />
          Show in File Explorer
        </Item>
      )}
      <Item
        className="item-menu-option destructive-menu-option"
        disabled={disabled}
        onSelect={onDelete}
      >
        <Icon name="trash" />
        Move to trash
      </Item>
    </>
  );
}

type ItemMenuProps = PropsWithChildren<{
  kind: MenuItemKind;
  name: string;
  /** The vault-relative path, for export and Show in File Explorer. */
  path?: string;
  /** The folder the item is in, preselected when moving it. */
  folder?: string | null;
  onOpen?: () => void;
  onNewDiagram?: () => void;
  onRename: (name: string) => Promise<RepositoryResult<unknown>>;
  onMove?: (folder: string | null) => Promise<RepositoryResult<unknown>>;
  onDelete: () => Promise<RepositoryResult<unknown>>;
}>;

/** The right-click and "…" menu shared by notes, diagrams and folders. */
export function ItemMenu({
  kind,
  name,
  path,
  folder = null,
  onOpen,
  onNewDiagram,
  onRename,
  onMove,
  onDelete,
  children,
}: ItemMenuProps) {
  const [dialog, setDialog] = useState<'rename' | 'move' | 'delete' | null>(null);
  const isMutating = useWorkspaceStore((state) => state.isMutating);
  const reveal = useRevealInFileExplorer();
  const actions: MenuActions = {
    kind,
    path,
    disabled: isMutating,
    onOpen,
    onNewDiagram,
    onRename: () => setDialog('rename'),
    onMove: onMove ? () => setDialog('move') : undefined,
    onReveal: reveal && path ? () => reveal(path) : undefined,
    onDelete: () => setDialog('delete'),
  };
  return (
    <>
      <ContextMenu.Root modal={false}>
        <ContextMenu.Trigger asChild>
          <div className={`item-context-trigger ${kind}-with-menu`}>
            {children}
            <DropdownMenu.Root modal={false}>
              <DropdownMenu.Trigger asChild>
                <Button
                  variant="ghost"
                  className="item-menu-trigger small-icon-button"
                  aria-label={`Actions for ${name}`}
                  disabled={isMutating}
                >
                  <Icon name="more" />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content className="item-menu-content" sideOffset={4} align="end">
                  <MenuItems variant="dropdown" {...actions} />
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Content className="item-menu-content">
            <MenuItems variant="context" {...actions} />
          </ContextMenu.Content>
        </ContextMenu.Portal>
      </ContextMenu.Root>
      {dialog === 'rename' && (
        <RenameItemDialog
          kind={kind}
          name={name}
          onRename={onRename}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'move' && onMove && (
        <MoveItemDialog
          kind={kind}
          name={name}
          folder={folder}
          onMove={onMove}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'delete' && (
        <DeleteItemDialog
          kind={kind}
          name={name}
          onDelete={onDelete}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}
