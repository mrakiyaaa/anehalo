import type { VaultItem } from '@/features/storage/vault-items';
import type { HomeFilter } from '@/store/home-filter-store';
import type { TextRange } from './search-text';

/** All, notes only, or diagrams only: the same choices as Home. */
export type SearchFilter = HomeFilter;

export interface SearchResult {
  item: VaultItem;
  snippet: { text: string; ranges: TextRange[] };
}

export interface SearchEngine {
  search(query: string, filter?: SearchFilter): Promise<readonly SearchResult[]>;
}
