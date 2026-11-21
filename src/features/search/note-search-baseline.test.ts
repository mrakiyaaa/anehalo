import { describe, expect, it } from 'vitest';
import { InMemoryNoteRepository } from '@/features/storage/InMemoryNoteRepository';
import type { MemoryEntry } from '@/features/storage/InMemoryVaultFileSystem';
import { unwrapResult } from '@/test/repository-helpers';
import { SearchIndex } from './SearchIndex';
import type { SearchResult } from './SearchEngine';

// Recorded before diagrams joined the index: note results must stay exactly the same.
const vault: readonly MemoryEntry[] = [
  { relativePath: 'Garden.md', type: 'file', content: 'Ideas for the garden', modifiedAt: 1 },
  {
    relativePath: 'Work/Payment gateway.md',
    type: 'file',
    content: '# Gateway\n\nThe payment gateway retries **twice**. See [Plan](Plan.md).',
    modifiedAt: 2,
  },
  {
    relativePath: 'Plan.md',
    type: 'file',
    content: '- [ ] Ship the gateway\n- [x] Café menu\n\n| a | b |\n|---|---|\n| one | two |',
    modifiedAt: 3,
  },
  {
    relativePath: 'සිංහල/සිංහල සටහන.md',
    type: 'file',
    content: 'මෙය සිංහල අදහසකි. garden',
    modifiedAt: 4,
  },
  {
    relativePath: 'தமிழ்/தமிழ் குறிப்பு.md',
    type: 'file',
    content: 'இது ஒரு தமிழ் குறிப்பு. CAFÉ',
    modifiedAt: 5,
  },
  { relativePath: 'Empty.md', type: 'file', content: '', modifiedAt: 6 },
];

const queries = [
  '',
  'garden',
  'GARDEN',
  'gateway',
  'payment gateway',
  'cafe',
  'café',
  'café',
  'සිංහල',
  'අදහස',
  'தமிழ்',
  'குறிப்பு',
  'plan',
  'missing',
  '  ship   gateway ',
];

function projection(result: SearchResult) {
  return { path: result.item.relativePath, snippet: result.snippet };
}

describe('note search results', () => {
  it('stay identical for the recorded queries', async () => {
    const repository = new InMemoryNoteRepository(vault);
    const index = new SearchIndex();
    unwrapResult(await index.refresh(repository, unwrapResult(await repository.listTree()).notes));
    const results: Record<string, unknown> = {};
    for (const query of queries) results[query] = (await index.search(query)).map(projection);
    await expect(JSON.stringify(results, null, 2)).toMatchFileSnapshot(
      './__snapshots__/note-search-baseline.json',
    );
  });
});
