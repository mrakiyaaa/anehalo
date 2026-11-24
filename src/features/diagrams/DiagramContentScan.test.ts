import { describe, expect, it, vi } from 'vitest';
import { failure, success, type RepositoryResult } from '@/features/storage/repository-result';
import { diagramSummary } from '@/features/storage/vault-items';
import type { DiagramSummary } from '@/types/notes';
import {
  DIAGRAM_READ_BATCH,
  DiagramContentScan,
  type DiagramContentListener,
} from './DiagramContentScan';

function recordingListener() {
  return {
    diagramRead: vi.fn<DiagramContentListener['diagramRead']>(),
    diagramSaved: vi.fn<DiagramContentListener['diagramSaved']>(),
    diagramRemoved: vi.fn<DiagramContentListener['diagramRemoved']>(),
  };
}

function setup(files: Record<string, string>) {
  const readOne = (path: string): RepositoryResult<string> =>
    path in files ? success(files[path] ?? '') : failure({ code: 'not-found', message: 'Gone.' });
  const readDiagramTexts = vi.fn(
    (paths: readonly string[]): Promise<readonly RepositoryResult<string>[]> =>
      Promise.resolve(paths.map(readOne)),
  );
  const readPaths = () => readDiagramTexts.mock.calls.flatMap(([paths]) => paths);
  const links = recordingListener();
  const search = recordingListener();
  const scan = new DiagramContentScan({ readDiagramTexts }, [links, search]);
  return { scan, readDiagramTexts, readPaths, readOne, links, search };
}

const numbered = (count: number) =>
  Array.from({ length: count }, (_, index) => `D${index}.excalidraw`);

const at = (path: string, modifiedAt: number): DiagramSummary => diagramSummary(path, modifiedAt);

describe('shared diagram scan', () => {
  it('reads each diagram once and hands the text to every listener', async () => {
    const { scan, readPaths, links, search } = setup({
      'A.excalidraw': 'a',
      'B.excalidraw': 'b',
    });
    expect((await scan.scan([at('A.excalidraw', 1), at('B.excalidraw', 1)])).ok).toBe(true);
    expect(readPaths()).toEqual(['A.excalidraw', 'B.excalidraw']);
    expect(links.diagramRead).toHaveBeenCalledWith(at('A.excalidraw', 1), 'a');
    expect(search.diagramRead).toHaveBeenCalledWith(at('B.excalidraw', 1), 'b');
    expect(scan.reads).toBe(2);
  });

  it('skips files whose modified time is unchanged and re-reads changed ones', async () => {
    const { scan, readDiagramTexts, readPaths, search } = setup({
      'A.excalidraw': 'a',
      'B.excalidraw': 'b',
    });
    await scan.scan([at('A.excalidraw', 1), at('B.excalidraw', 1)]);
    readDiagramTexts.mockClear();
    search.diagramRead.mockClear();
    await scan.scan([at('A.excalidraw', 1), at('B.excalidraw', 2)]);
    expect(readPaths()).toEqual(['B.excalidraw']);
    expect(search.diagramRead).toHaveBeenCalledOnce();
  });

  it('tells listeners about diagrams that left the vault', async () => {
    const { scan, links, search } = setup({ 'A.excalidraw': 'a' });
    await scan.scan([at('A.excalidraw', 1)]);
    await scan.scan([]);
    expect(links.diagramRemoved).toHaveBeenCalledWith('A.excalidraw');
    expect(search.diagramRemoved).toHaveBeenCalledWith('A.excalidraw');
  });

  it('passes an in-app save on without reading, and does not read that version again', async () => {
    const { scan, readDiagramTexts, links, search } = setup({ 'A.excalidraw': 'a' });
    const elements = [{ id: 'x', type: 'text', text: 'Saved' }];
    scan.saved(at('A.excalidraw', 5), elements);
    expect(links.diagramSaved).toHaveBeenCalledWith(at('A.excalidraw', 5), elements);
    expect(search.diagramSaved).toHaveBeenCalledWith(at('A.excalidraw', 5), elements);
    await scan.scan([at('A.excalidraw', 5)]);
    expect(readDiagramTexts).not.toHaveBeenCalled();
  });

  it('keeps a rename from causing a read, and reads a trashed diagram again on restore', async () => {
    const { scan, readPaths } = setup({
      'Plans/A.excalidraw': 'a',
      'Work/A.excalidraw': 'a',
    });
    await scan.scan([at('Plans/A.excalidraw', 1)]);
    scan.relocate('Plans', 'Work');
    await scan.scan([at('Work/A.excalidraw', 1)]);
    expect(readPaths()).toEqual(['Plans/A.excalidraw']);
    scan.forget('Work/A.excalidraw');
    await scan.scan([at('Work/A.excalidraw', 1)]);
    expect(readPaths()).toEqual(['Plans/A.excalidraw', 'Work/A.excalidraw']);
  });

  it('lets a save made while the file was being read win over the older text', async () => {
    const { scan, readDiagramTexts, search } = setup({});
    let finishRead: (results: readonly RepositoryResult<string>[]) => void = () => undefined;
    readDiagramTexts.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishRead = resolve;
        }),
    );
    const scanned = scan.scan([at('A.excalidraw', 1)]);
    scan.saved(at('A.excalidraw', 2), []);
    finishRead([success('old')]);
    await scanned;
    expect(search.diagramRead).not.toHaveBeenCalled();
    expect(search.diagramSaved).toHaveBeenCalledOnce();
  });

  it('reports files it could not read, and stops when cancelled', async () => {
    const { scan, search } = setup({ 'A.excalidraw': 'a' });
    const result = await scan.scan([at('Missing.excalidraw', 1), at('A.excalidraw', 1)]);
    expect(result).toMatchObject({ ok: false, error: { code: 'io-error' } });
    expect(search.diagramRead).toHaveBeenCalledOnce();

    const cancelled = setup({ 'A.excalidraw': 'a' });
    const pending = cancelled.scan.scan([at('A.excalidraw', 1)]);
    cancelled.scan.cancel();
    expect((await pending).ok).toBe(true);
    expect(cancelled.search.diagramRead).not.toHaveBeenCalled();
  });

  it('reads diagrams in batches, not one round trip per file', async () => {
    const paths = numbered(45);
    const { scan, readDiagramTexts, readPaths, search } = setup(
      Object.fromEntries(paths.map((path) => [path, path])),
    );
    expect((await scan.scan(paths.map((path) => at(path, 1)))).ok).toBe(true);
    expect(readDiagramTexts.mock.calls.map(([batch]) => batch.length)).toEqual([
      DIAGRAM_READ_BATCH,
      DIAGRAM_READ_BATCH,
      45 - 2 * DIAGRAM_READ_BATCH,
    ]);
    expect(readPaths()).toEqual(paths);
    expect(search.diagramRead).toHaveBeenCalledTimes(45);
    expect(scan.reads).toBe(45);
  });

  it('asks again for the files a byte-capped reply left out, reading each once', async () => {
    const paths = numbered(5);
    const { scan, readDiagramTexts, readPaths, readOne, search } = setup(
      Object.fromEntries(paths.map((path) => [path, path])),
    );
    readDiagramTexts.mockImplementation((batch) => Promise.resolve(batch.slice(0, 2).map(readOne)));
    expect((await scan.scan(paths.map((path) => at(path, 1)))).ok).toBe(true);
    expect(readPaths()).toEqual([...paths, ...paths.slice(2), ...paths.slice(4)]);
    expect(search.diagramRead.mock.calls.map(([diagram]) => diagram.relativePath)).toEqual(paths);
  });

  it('does not read a diagram again that was saved while an earlier batch was read', async () => {
    const paths = numbered(3);
    const { scan, readDiagramTexts, readPaths, readOne } = setup(
      Object.fromEntries(paths.map((path) => [path, path])),
    );
    readDiagramTexts.mockImplementationOnce((batch) => {
      scan.saved(at('D2.excalidraw', 1), []);
      return Promise.resolve(batch.slice(0, 1).map(readOne));
    });
    await scan.scan(paths.map((path) => at(path, 1)));
    expect(readPaths()).toEqual([...paths, 'D1.excalidraw']);
  });

  it('reports an empty reply instead of asking forever', async () => {
    const { scan, readDiagramTexts } = setup({});
    readDiagramTexts.mockResolvedValue([]);
    const result = await scan.scan([at('A.excalidraw', 1)]);
    expect(result).toMatchObject({ ok: false, error: { code: 'io-error' } });
    expect(readDiagramTexts).toHaveBeenCalledOnce();
  });
});
