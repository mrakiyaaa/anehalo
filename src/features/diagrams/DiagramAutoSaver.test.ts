import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { unwrapResult } from '@/test/repository-helpers';
import { diagramFile, editOutsideAnehalo, memoryVault, sceneWith } from '@/test/diagram-helpers';
import { DiagramAutoSaver } from './DiagramAutoSaver';

const path = 'Flow.excalidraw';

async function openFlow() {
  const vault = memoryVault([{ relativePath: path, type: 'file', content: diagramFile('start') }]);
  const saver = new DiagramAutoSaver(vault.diagrams);
  unwrapResult(await saver.open(unwrapResult(await vault.diagrams.readDiagram(path))));
  return { ...vault, saver };
}

/** Lets queued promise work finish between fake-timer steps. */
async function settle() {
  await vi.advanceTimersByTimeAsync(0);
}

describe('DiagramAutoSaver', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
  });
  afterEach(() => vi.useRealTimers());

  it('saves after a quiet half second, not on every change', async () => {
    const { saver, files } = await openFlow();

    saver.update(sceneWith('start', 'box'));
    await vi.advanceTimersByTimeAsync(300);
    saver.update(sceneWith('start', 'box', 'arrow'));
    await vi.advanceTimersByTimeAsync(300);

    expect(await files.readText(path)).toBe(diagramFile('start'));
    expect(saver.draft?.status).toBe('saving');
    await vi.advanceTimersByTimeAsync(500);
    expect(await files.readText(path)).toBe(diagramFile('start', 'box', 'arrow'));
    expect(saver.draft).toMatchObject({ status: 'saved', dirty: false, error: null });
  });

  it('never writes over an outside change; the user chooses which version to keep', async () => {
    const { saver, files } = await openFlow();
    vi.setSystemTime(2_000_000);
    await editOutsideAnehalo(files, path, diagramFile('theirs'));

    saver.update(sceneWith('mine'));
    await vi.advanceTimersByTimeAsync(500);

    expect(saver.draft).toMatchObject({ hasExternalChange: true, error: { code: 'conflict' } });
    expect(await files.readText(path)).toBe(diagramFile('theirs'));

    unwrapResult(await saver.resolveConflict('mine'));
    expect(await files.readText(path)).toBe(diagramFile('mine'));
    expect(saver.draft).toMatchObject({ hasExternalChange: false, status: 'saved' });
  });

  it('loads the outside version when the user picks theirs', async () => {
    const { saver, files } = await openFlow();
    vi.setSystemTime(2_000_000);
    await editOutsideAnehalo(files, path, diagramFile('theirs'));
    saver.update(sceneWith('mine'));
    await vi.advanceTimersByTimeAsync(500);

    unwrapResult(await saver.resolveConflict('theirs'));

    expect(saver.draft?.scene.elements.map((element) => element.id)).toEqual(['theirs']);
    expect(saver.draft).toMatchObject({ dirty: false, documentVersion: 1 });
    expect(await files.readText(path)).toBe(diagramFile('theirs'));
  });

  it('quietly reloads an outside change when nothing is unsaved', async () => {
    const { saver, files } = await openFlow();
    vi.setSystemTime(2_000_000);
    await editOutsideAnehalo(files, path, diagramFile('edited elsewhere'));

    unwrapResult(await saver.checkExternal());

    expect(saver.draft?.scene.elements.map((element) => element.id)).toEqual(['edited elsewhere']);
    expect(saver.draft).toMatchObject({ hasExternalChange: false, documentVersion: 1 });
  });

  it('keeps the drawing when the file disappears, without retrying', async () => {
    const { saver, files } = await openFlow();
    await files.rename(path, 'Moved away.excalidraw');

    saver.update(sceneWith('start', 'box'));
    await vi.advanceTimersByTimeAsync(500);
    await vi.advanceTimersByTimeAsync(60_000);

    expect(saver.draft).toMatchObject({
      isMissing: true,
      dirty: true,
      error: { code: 'not-found' },
    });
    expect(await files.metadata(path)).toBeNull();
  });

  it('retries a failed write with backoff', async () => {
    const { saver, files } = await openFlow();
    files.failNext('write');

    saver.update(sceneWith('start', 'box'));
    await vi.advanceTimersByTimeAsync(500);
    expect(saver.draft).toMatchObject({ status: 'retrying', dirty: true });

    await vi.advanceTimersByTimeAsync(1000);
    await settle();
    expect(saver.draft).toMatchObject({ status: 'saved', dirty: false, error: null });
    expect(await files.readText(path)).toBe(diagramFile('start', 'box'));
  });

  it('saves pending changes before closing', async () => {
    const { saver, files } = await openFlow();
    saver.update(sceneWith('start', 'last'));

    unwrapResult(await saver.close());

    expect(await files.readText(path)).toBe(diagramFile('start', 'last'));
    expect(saver.draft).toBeNull();
  });
});
