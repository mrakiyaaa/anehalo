import { filterItems } from '@/features/notes/filter-items';
import { ItemCard } from '@/features/notes/ItemCard';
import { HomeFilterChips } from '@/features/notes/HomeFilterChips';
import { vaultItems, type VaultItem } from '@/features/storage/vault-items';
import { countLabel } from '@/features/storage/vault-counts';
import { useCurrentTime } from '@/lib/use-current-time';
import { useWorkspaceStore } from '@/store/use-workspace-store';
import { useHomeFilterStore, type HomeFilter } from '@/store/home-filter-store';
import { Logo } from '@/components/ui/Logo';
import { VirtualItems } from './VirtualItems';

const kinds: Readonly<Record<HomeFilter, VaultItem['kind'] | null>> = {
  all: null,
  notes: 'note',
  diagrams: 'diagram',
};

const nouns: Readonly<Record<HomeFilter, readonly [string, string]>> = {
  all: ['item', 'items'],
  notes: ['note', 'notes'],
  diagrams: ['diagram', 'diagrams'],
};

/** Notes and diagrams of the selected folder, newest first, filtered by kind. */
export function RecentItems() {
  const tree = useWorkspaceStore((state) => state.tree);
  const activeFolderPath = useWorkspaceStore((state) => state.activeFolderPath);
  const searchText = useWorkspaceStore((state) => state.searchText);
  const isLoading = useWorkspaceStore((state) => state.isLoading);
  const filter = useHomeFilterStore((state) => state.filter);
  const currentTime = useCurrentTime();
  const kind = kinds[filter];
  const items = filterItems(
    vaultItems(tree).filter((item) => kind === null || item.kind === kind),
    { activeFolderPath, searchText },
  );
  const activeFolder = tree.folders.find((folder) => folder.relativePath === activeFolderPath);
  const [singular, plural] = nouns[filter];
  return (
    <section aria-labelledby="recent-items-heading" aria-busy={isLoading}>
      <div className="notes-section-header">
        <h2 id="recent-items-heading">{activeFolder?.name ?? 'Recent'}</h2>
        <HomeFilterChips />
        <span aria-live="polite">
          {isLoading
            ? 'Refreshing…'
            : `${countLabel(items.length, singular, plural)} · last edited first`}
        </span>
      </div>
      <div className="notes-grid">
        <VirtualItems
          items={items}
          layout="grid"
          renderItem={(item) => (
            <ItemCard key={item.relativePath} item={item} currentTime={currentTime.getTime()} />
          )}
        />
        {items.length === 0 && (
          <div className="notes-empty">
            {!isLoading && <Logo variant="full" />}
            <p>
              {isLoading
                ? 'Opening your notes…'
                : searchText.trim()
                  ? 'Nothing matches your search.'
                  : `No ${plural} here yet. Use Quick note or New diagram to start.`}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
