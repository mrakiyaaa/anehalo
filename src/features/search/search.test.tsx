import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { InMemoryNoteRepository } from '@/features/storage/InMemoryNoteRepository';
import { unwrapResult } from '@/test/repository-helpers';
import { SearchIndex } from './SearchIndex';
import { IndexedNoteRepository } from './IndexedNoteRepository';
import { matchingRanges, normalizedText, searchPlainText, searchSnippet } from './search-text';
import { HighlightedSnippet } from './SearchPalette';

async function indexedVault() {
  const source = new InMemoryNoteRepository();
  unwrapResult(await source.initializeVault());
  const index = new SearchIndex();
  const repository = new IndexedNoteRepository(source, index);
  return { source, index, repository };
}

describe('search index', () => {
  it('ranks titles above body matches and returns the eight most recent notes for an empty query', async () => {
    const { source, index } = await indexedVault();
    for (let number = 0; number < 10; number++)
      unwrapResult(
        await source.createNote({ title: `Note ${number}`, content: 'A garden thought' }),
      );
    unwrapResult(await source.createNote({ title: 'Garden', content: 'Ideas' }));
    const notes = unwrapResult(await source.listTree()).notes.map((note, position) => ({
      ...note,
      modifiedAt: position,
    }));
    const originalRead = source.readNote.bind(source);
    const read = vi.spyOn(source, 'readNote');
    read.mockImplementation(async (path) => {
      const original = await originalRead(path);
      return original.ok
        ? {
            ok: true,
            value: {
              ...original.value,
              modifiedAt: notes.find((note) => note.relativePath === path)?.modifiedAt ?? 0,
            },
          }
        : original;
    });
    unwrapResult(await index.refresh(source, notes));
    expect((await index.search('garden'))[0]?.note.title).toBe('Garden');
    expect(await index.search('')).toHaveLength(8);
    expect((await index.search('')).map((result) => result.note.modifiedAt)).toEqual(
      [...notes]
        .sort((left, right) => right.modifiedAt - left.modifiedAt)
        .slice(0, 8)
        .map((note) => note.modifiedAt),
    );
  });

  it.each(['සිංහල', 'தமிழ்', 'සිංහල தமிழ் café', 'CAFÉ', 'cafe\u0301'])(
    'matches multilingual text: %s',
    async (query) => {
      const { source, index } = await indexedVault();
      unwrapResult(await source.createNote({ title: 'Languages', content: 'සිංහල தமிழ் café' }));
      unwrapResult(await index.refresh(source, unwrapResult(await source.listTree()).notes));
      expect((await index.search(query)).map((result) => result.note.title)).toContain('Languages');
    },
  );

  it('preserves meaningful Sinhala and Tamil vowel signs', () => {
    expect(normalizedText('කි').value).not.toBe(normalizedText('ක').value);
    expect(normalizedText('கி').value).not.toBe(normalizedText('க').value);
    expect(matchingRanges('Café தமிழ்', 'cafe')).toEqual([{ start: 0, end: 4 }]);
    expect(matchingRanges('தமிழ்', 'தமிழ்')).toEqual([{ start: 0, end: 5 }]);
  });

  it('updates after save, rename, folder rename and deletion', async () => {
    const { repository, source, index } = await indexedVault();
    unwrapResult(await repository.createFolder('Work'));
    const created = unwrapResult(
      await repository.createNote({ title: 'Draft', folder: 'Work', content: 'firstword' }),
    );
    await waitFor(async () => expect(await index.search('firstword')).toHaveLength(1));
    unwrapResult(await repository.writeNote(created.relativePath, 'secondword'));
    await waitFor(async () => expect(await index.search('secondword')).toHaveLength(1));
    expect(await index.search('firstword')).toHaveLength(0);
    unwrapResult(await repository.renameNote(created.relativePath, 'Renamed'));
    await waitFor(async () =>
      expect((await index.search('secondword'))[0]?.note.title).toBe('Renamed'),
    );
    unwrapResult(await repository.renameFolder('Work', 'Life'));
    expect((await index.search('secondword'))[0]?.note.folder).toBe('Life');
    unwrapResult(await repository.deleteNote('Life/Renamed.md'));
    expect(await index.search('secondword')).toHaveLength(0);
    unwrapResult(await source.createNote({ title: 'Outside', content: 'externalword' }));
    unwrapResult(await index.refresh(source, unwrapResult(await source.listTree()).notes));
    expect(await index.search('externalword')).toHaveLength(1);
  });

  it('does not resurrect a deleted note when an older refresh finishes', async () => {
    const { source, index } = await indexedVault();
    const note = unwrapResult(await source.createNote({ title: 'Draft', content: 'racingword' }));
    let finishRead: (() => void) | undefined;
    const originalRead = source.readNote.bind(source);
    vi.spyOn(source, 'readNote').mockImplementation(async (path) => {
      const result = await originalRead(path);
      await new Promise<void>((resolve) => {
        finishRead = resolve;
      });
      return result;
    });
    const refresh = index.refresh(source, [note]);
    await waitFor(() => expect(finishRead).toBeDefined());
    index.remove(note.relativePath);
    finishRead?.();
    await refresh;
    expect(await index.search('racingword')).toHaveLength(0);
  });
});

describe('plain text and safe snippets', () => {
  it('removes Markdown, HTML, definitions, image paths and link targets', () => {
    const plain = searchPlainText(
      '# Title\n**bold** [visible](secret/path.md) ![photo](hidden.png) <b>hello</b>\n\n[reference]: /private/target\n\n[[private/Other.md|Other label]]',
    );
    expect(plain).toContain('Title');
    expect(plain).toContain('Other label');
    expect(plain).not.toMatch(/secret|hidden|private|<b>|\*\*/);
  });
  it('finds a snippet around a distant match and renders text without HTML injection', () => {
    const snippet = searchSnippet(
      `${'intro '.repeat(100)}<img src=x onerror=alert(1)> Café தமிழ்`,
      'cafe தமிழ்',
    );
    render(
      <p data-testid="snippet">
        <HighlightedSnippet snippet={snippet} />
      </p>,
    );
    const output = screen.getByTestId('snippet');
    expect(output.querySelector('img')).toBeNull();
    expect([...output.querySelectorAll('mark')].map((mark) => mark.textContent)).toEqual([
      'Café',
      'தமிழ்',
    ]);
    expect(output.textContent).toContain('<img');
    expect(output.textContent?.startsWith('…')).toBe(true);
  });
});
