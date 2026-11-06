import * as ContextMenu from '@radix-ui/react-context-menu';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useState, type PropsWithChildren } from 'react';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/Icon';
import { DeleteItemDialog } from '@/components/ui/DeleteItemDialog';
import { RenameItemDialog } from '@/components/ui/RenameItemDialog';
import type { RepositoryResult } from '@/features/storage/repository-result';
import { useWorkspaceStore } from '@/store/use-workspace-store';
import { ExportMenuItems } from '@/features/export/ExportMenu';

interface MenuActions {
  onRename: () => void;
  onDelete: () => void;
  disabled: boolean;
  notePath?: string | undefined;
}

function MenuItems({
  variant,
  onRename,
  onDelete,
  disabled,
  notePath,
}: MenuActions & { variant: 'context' | 'dropdown' }) {
  const Item = variant === 'context' ? ContextMenu.Item : DropdownMenu.Item;
  return (
    <>
      <Item className="item-menu-option" disabled={disabled} onSelect={onRename}>
        <Icon name="pen" />
        Rename
      </Item>
      {notePath && <ExportMenuItems path={notePath} variant={variant} />}
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
  kind: 'note' | 'folder';
  name: string;
  onRename: (name: string) => Promise<RepositoryResult<unknown>>;
  onDelete: () => Promise<RepositoryResult<unknown>>;
  notePath?: string;
}>;

export function ItemMenu({ kind, name, onRename, onDelete, notePath, children }: ItemMenuProps) {
  const [dialog, setDialog] = useState<'rename' | 'delete' | null>(null);
  const isMutating = useWorkspaceStore((state) => state.isMutating);
  const actions: MenuActions = {
    onRename: () => setDialog('rename'),
    onDelete: () => setDialog('delete'),
    disabled: isMutating,
    notePath,
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
