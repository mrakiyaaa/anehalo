import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/Icon';
import { ItemMenu } from '@/components/ui/ItemMenu';
import { filterItems } from '@/features/notes/filter-items';
import { vaultItems, type VaultItem } from '@/features/storage/vault-items';
import { useWorkspaceStore } from '@/store/use-workspace-store';
import { Logo } from '@/components/ui/Logo';
import { VirtualItems } from './VirtualItems';
import { useItemActions } from './use-item-actions';

interface SidebarItemProps {
  readonly item: VaultItem;
  readonly current: boolean;
  readonly unsaved: boolean;
}

function SidebarItem({ item, current, unsaved }: SidebarItemProps) {
  const actions = useItemActions(item);
  return (
    <ItemMenu
      kind={item.kind}
      name={item.title}
      path={item.relativePath}
      folder={item.folder}
      onOpen={actions.open}
      onRename={actions.rename}
      {...(actions.move ? { onMove: actions.move } : {})}
      onDelete={actions.remove}
    >
      <Button
        variant="ghost"
        className="sidebar-note"
        aria-current={current ? 'page' : undefined}
        title={item.relativePath}
        onClick={actions.open}
      >
        <Icon name={item.kind === 'diagram' ? 'shapes' : 'pen'} />
        <span>{item.title}</span>
        {unsaved && <span className="unsaved-dot" aria-label="Unsaved changes" />}
      </Button>
    </ItemMenu>
  );
}

/** Notes and diagrams of the selected folder, newest first. */
export function SidebarItems() {
  const tree = useWorkspaceStore((state) => state.tree);
  const activeFolderPath = useWorkspaceStore((state) => state.activeFolderPath);
  const searchText = useWorkspaceStore((state) => state.searchText);
  const currentNote = useWorkspaceStore((state) => state.openDraft);
  const currentDiagram = useWorkspaceStore((state) => state.diagram);
  const view = useWorkspaceStore((state) => state.view);
  const openNote = useWorkspaceStore((state) => state.openNote);
  const pendingDrafts = useWorkspaceStore((state) => state.pendingDrafts);
  const items = filterItems(vaultItems(tree), { activeFolderPath, searchText });
  const retainedDrafts = pendingDrafts.filter(
    (draft) => !items.some((item) => item.relativePath === draft.note.relativePath),
  );

  function isCurrent(item: VaultItem) {
    return item.kind === 'diagram'
      ? view === 'diagram' && currentDiagram?.summary.relativePath === item.relativePath
      : view === 'editor' && currentNote?.note.relativePath === item.relativePath;
  }

  function renderItem(item: VaultItem) {
    return (
      <SidebarItem
        key={item.relativePath}
        item={item}
        current={isCurrent(item)}
        unsaved={pendingDrafts.some((draft) => draft.note.relativePath === item.relativePath)}
      />
    );
  }

  return (
    <>
      <div className="sidebar-section-label">Items</div>
      <nav className="sidebar-notes" aria-label="Items">
        <VirtualItems items={items} layout="list" renderItem={renderItem} />
        {items.length === 0 && (
          <div className="sidebar-notes-empty">
            <Logo variant="full" />
            <p>{searchText.trim() ? 'Nothing matches your search' : 'Nothing here yet'}</p>
          </div>
        )}
      </nav>
      {retainedDrafts.length > 0 && (
        <>
          <div className="sidebar-section-label">Unsaved drafts</div>
          <nav className="sidebar-notes" aria-label="Unsaved drafts">
            {retainedDrafts.map((draft) => (
              <Button
                key={draft.identifier}
                variant="ghost"
                className="sidebar-note"
                title={draft.note.relativePath}
                onClick={() => {
                  void openNote(draft.note.relativePath);
                }}
              >
                <Icon name="pen" />
                <span>{draft.title || 'Untitled note'}</span>
                <span className="unsaved-dot" />
              </Button>
            ))}
          </nav>
        </>
      )}
    </>
  );
}
