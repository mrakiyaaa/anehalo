import { isInsideFolder } from '@/features/storage/storage-paths';

interface ItemFilters {
  activeFolderPath: string | null;
  searchText: string;
}

interface FilterableItem {
  readonly title: string;
  readonly relativePath: string;
  /** A note's full text; diagrams are matched by title only. */
  readonly searchText?: string;
}

export function filterItems<Item extends FilterableItem>(
  items: readonly Item[],
  { activeFolderPath, searchText }: ItemFilters,
): Item[] {
  const normalizedSearch = searchText.trim().toLocaleLowerCase();

  return items.filter((item) => {
    const matchesFolder =
      activeFolderPath === null || isInsideFolder(item.relativePath, activeFolderPath);
    const matchesSearch =
      !normalizedSearch ||
      `${item.title} ${item.searchText ?? ''}`.toLocaleLowerCase().includes(normalizedSearch);
    return matchesFolder && matchesSearch;
  });
}
