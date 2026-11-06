import type { NoteSummary } from '@/types/notes';
import type { TextRange } from './search-text';

export interface SearchResult {
  note: NoteSummary;
  snippet: { text: string; ranges: TextRange[] };
}

export interface SearchEngine {
  search(query: string): Promise<readonly SearchResult[]>;
}
