import { afterEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import { InMemoryNoteRepository } from '@/features/storage/InMemoryNoteRepository';
import { diagramSummary } from '@/features/storage/vault-items';
import { unwrapResult } from '@/test/repository-helpers';
import { SearchIndex } from './SearchIndex';

const logFailure = vi.hoisted(() => vi.fn());
vi.mock('@/features/diagnostics/error-logging', () => ({ logFailure }));

afterEach(() => logFailure.mockClear());

const file = (elements: object[]) => JSON.stringify({ type: 'excalidraw', elements });
const text = (id: string, words: string, extra: object = {}) => ({
  id,
  type: 'text',
  text: words,
  ...extra,
});

/** Feeds diagrams the way the shared scan does, then waits for them to be searchable. */
async function indexWith(diagrams: Record<string, object[]>, notes: Record<string, string> = {}) {
  const repository = new InMemoryNoteRepository(
    Object.entries(notes).map(([relativePath, content], position) => ({
      relativePath,
      type: 'file' as const,
      content,
      modifiedAt: position + 1,
    })),
  );
  const index = new SearchIndex();
  unwrapResult(await index.refresh(repository, unwrapResult(await repository.listTree()).notes));
  for (const [path, elements] of Object.entries(diagrams))
    index.diagramRead(diagramSummary(path, 100), file(elements));
  await waitFor(async () =>
    expect(await index.search('', 'diagrams')).toHaveLength(
      Math.min(8, Object.keys(diagrams).length),
    ),
  );
  return index;
}

const titles = async (index: SearchIndex, query: string, filter?: 'all' | 'notes' | 'diagrams') =>
  (await index.search(query, filter)).map((result) => result.item.title);

describe('searching diagrams', () => {
  it('finds diagrams by title and by the text inside them, with a highlighted snippet', async () => {
    const index = await indexWith({
      'Plans/Checkout.excalidraw': [text('a', 'Payment gateway'), text('b', 'Retry twice')],
    });
    expect(await titles(index, 'checkout')).toEqual(['Checkout']);
    const [found] = await index.search('gateway');
    expect(found?.item).toMatchObject({ kind: 'diagram', folder: 'Plans' });
    expect(found?.snippet.text).toBe('Payment gateway Retry twice');
    expect(found?.snippet.ranges).toEqual([{ start: 8, end: 15 }]);
  });

  it.each([
    ['සිංහල', 'සිංහල සටහන'],
    ['සටහ', 'සිංහල සටහන'],
    ['தமிழ்', 'தமிழ் குறிப்பு'],
    ['GATEWAY', 'Payment gateway'],
    ['cafe', 'Café menu'],
  ])('matches %s inside a diagram the way notes match it', async (query, words) => {
    const index = await indexWith({ 'Flow.excalidraw': [text('a', words)] }, { 'Note.md': words });
    expect((await index.search(query)).map(({ item }) => item.kind).sort()).toEqual([
      'diagram',
      'note',
    ]);
  });

  it('ranks title matches above content matches, with the same scoring as notes', async () => {
    const index = await indexWith(
      {
        'Inside.excalidraw': [text('a', 'gateway')],
        'Gateway.excalidraw': [text('a', 'Other words')],
      },
      { 'Gateway note.md': 'Body', 'Mention.md': 'the gateway' },
    );
    const ranked = await titles(index, 'gateway');
    expect(ranked.slice(0, 2).sort()).toEqual(['Gateway', 'Gateway note']);
    expect(ranked.slice(2).sort()).toEqual(['Inside', 'Mention']);
  });

  it('filters to notes or diagrams before ranking', async () => {
    const index = await indexWith(
      { 'Flow.excalidraw': [text('a', 'garden')] },
      { 'Garden.md': 'x' },
    );
    expect(await titles(index, 'garden', 'notes')).toEqual(['Garden']);
    expect(await titles(index, 'garden', 'diagrams')).toEqual(['Flow']);
    expect((await titles(index, 'garden')).sort()).toEqual(['Flow', 'Garden']);
  });

  it('finds the element to show for a content match, but none for a title match', async () => {
    const index = await indexWith({
      'Checkout.excalidraw': [
        { id: 'box', type: 'rectangle' },
        text('label', 'Payment gateway', { containerId: 'box' }),
        { id: 'frame', type: 'frame', name: 'Release' },
      ],
    });
    expect(index.matchedElement('Checkout.excalidraw', 'gateway')).toBe('box');
    expect(index.matchedElement('Checkout.excalidraw', 'checkout release')).toBe('frame');
    expect(index.matchedElement('Checkout.excalidraw', 'checkout')).toBeNull();
    expect(index.matchedElement('Missing.excalidraw', 'gateway')).toBeNull();
  });

  it('uses the in-memory scene after a save', async () => {
    const index = await indexWith({ 'Flow.excalidraw': [text('a', 'before')] });
    index.diagramSaved(diagramSummary('Flow.excalidraw', 200), [text('a', 'after')]);
    await waitFor(async () => expect(await titles(index, 'after')).toEqual(['Flow']));
    expect(await titles(index, 'before')).toEqual([]);
  });

  it('follows a rename or move, and forgets a trashed diagram until it is read again', async () => {
    const index = await indexWith({ 'Plans/Flow.excalidraw': [text('a', 'gateway')] });
    index.relocateDiagram('Plans/Flow.excalidraw', diagramSummary('Work/Pipeline.excalidraw', 100));
    const [moved] = await index.search('gateway');
    expect(moved?.item).toMatchObject({ title: 'Pipeline', folder: 'Work' });
    expect(await titles(index, 'pipeline')).toEqual(['Pipeline']);
    expect(await titles(index, 'flow')).toEqual([]);

    index.relocateFolder('Work', 'Archive');
    expect((await index.search('gateway'))[0]?.item.relativePath).toBe(
      'Archive/Pipeline.excalidraw',
    );

    index.remove('Archive/Pipeline.excalidraw');
    expect(await titles(index, 'gateway')).toEqual([]);
    index.diagramRead(
      diagramSummary('Archive/Pipeline.excalidraw', 100),
      file([text('a', 'gateway')]),
    );
    await waitFor(async () => expect(await titles(index, 'gateway')).toEqual(['Pipeline']));
  });

  it('skips a corrupt diagram, logs it once, and keeps searching', async () => {
    const index = await indexWith({ 'Good.excalidraw': [text('a', 'gateway')] });
    index.diagramRead(diagramSummary('Broken.excalidraw', 1), '{"type":"excal');
    await waitFor(() => expect(logFailure).toHaveBeenCalledOnce());
    expect(logFailure).toHaveBeenCalledWith('diagram-search-skipped', 'invalid-diagram');
    expect(await titles(index, 'gateway')).toEqual(['Good']);
    expect(await titles(index, 'broken')).toEqual([]);
  });

  // Regression: a refresh that finished while a diagram was being analysed dropped the diagram.
  it('keeps queued work when a note refresh finishes while it is being analysed', async () => {
    const repository = new InMemoryNoteRepository([]);
    const index = new SearchIndex();
    index.diagramRead(diagramSummary('Flow.excalidraw', 1), file([text('a', 'gateway')]));
    // One tick: the queue starts analysing, then the refresh completes in between.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    unwrapResult(await index.refresh(repository, []));
    await waitFor(async () => expect(await titles(index, 'gateway')).toEqual(['Flow']));
  });

  it('keeps diagrams when notes are refreshed', async () => {
    const repository = new InMemoryNoteRepository([]);
    const index = await indexWith({ 'Flow.excalidraw': [text('a', 'gateway')] });
    unwrapResult(await index.refresh(repository, []));
    expect(await titles(index, 'gateway')).toEqual(['Flow']);
  });
});
