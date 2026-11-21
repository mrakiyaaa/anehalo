import { describe, expect, it, vi } from 'vitest';
import { failure, success, type RepositoryResult } from '@/features/storage/repository-result';
import { diagramSummary } from '@/features/storage/vault-items';
import type { DiagramSummary } from '@/types/notes';
import { DiagramContentScan, type DiagramContentListener } from './DiagramContentScan';

function recordingListener() {
  return {
    diagramRead: vi.fn<DiagramContentListener['diagramRead']>(),
    diagramSaved: vi.fn<DiagramContentListener['diagramSaved']>(),
    diagramRemoved: vi.fn<DiagramContentListener['diagramRemoved']>(),
  };
}

function setup(files: Record<string, string>) {
  const readDiagramText = vi.fn((path: string): Promise<RepositoryResult<string>> =>
    Promise.resolve(
      path in files ? success(files[path] ?? '') : failure({ code: 'not-found', message: 'Gone.' }),
    ),
  );
  const links = recordingListener();
  const search = recordingListener();
  const scan = new DiagramContentScan({ readDiagramText }, [links, search]);
  return { scan, readDiagramText, links, search };
}

const at = (path: string, modifiedAt: number): DiagramSummary => diagramSummary(path, modifiedAt);

describe('shared diagram scan', () => {
  it('reads each diagram once and hands the text to every listener', async () => {
    const { scan, readDiagramText, links, search } = setup({
      'A.excalidraw': 'a',
      'B.excalidraw': 'b',
    });
    expect((await scan.scan([at('A.excalidraw', 1), at('B.excalidraw', 1)])).ok).toBe(true);
    expect(readDiagramText).toHaveBeenCalledTimes(2);
    expect(links.diagramRead).toHaveBeenCalledWith(at('A.excalidraw', 1), 'a');
    expect(search.diagramRead).toHaveBeenCalledWith(at('B.excalidraw', 1), 'b');
    expect(scan.reads).toBe(2);
  });

  it('skips files whose modified time is unchanged and re-reads changed ones', async () => {
    const { scan, readDiagramText, search } = setup({ 'A.excalidraw': 'a', 'B.excalidraw': 'b' });
    await scan.scan([at('A.excalidraw', 1), at('B.excalidraw', 1)]);
    readDiagramText.mockClear();
    search.diagramRead.mockClear();
    await scan.scan([at('A.excalidraw', 1), at('B.excalidraw', 2)]);
    expect(readDiagramText.mock.calls.map(([path]) => path)).toEqual(['B.excalidraw']);
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
    const { scan, readDiagramText, links, search } = setup({ 'A.excalidraw': 'a' });
    const elements = [{ id: 'x', type: 'text', text: 'Saved' }];
    scan.saved(at('A.excalidraw', 5), elements);
    expect(links.diagramSaved).toHaveBeenCalledWith(at('A.excalidraw', 5), elements);
    expect(search.diagramSaved).toHaveBeenCalledWith(at('A.excalidraw', 5), elements);
    await scan.scan([at('A.excalidraw', 5)]);
    expect(readDiagramText).not.toHaveBeenCalled();
  });

  it('keeps a rename from causing a read, and reads a trashed diagram again on restore', async () => {
    const { scan, readDiagramText } = setup({
      'Plans/A.excalidraw': 'a',
      'Work/A.excalidraw': 'a',
    });
    await scan.scan([at('Plans/A.excalidraw', 1)]);
    scan.relocate('Plans', 'Work');
    await scan.scan([at('Work/A.excalidraw', 1)]);
    expect(readDiagramText).toHaveBeenCalledTimes(1);
    scan.forget('Work/A.excalidraw');
    await scan.scan([at('Work/A.excalidraw', 1)]);
    expect(readDiagramText).toHaveBeenCalledTimes(2);
  });

  it('lets a save made while the file was being read win over the older text', async () => {
    const { scan, readDiagramText, search } = setup({});
    let finishRead: (result: RepositoryResult<string>) => void = () => undefined;
    readDiagramText.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishRead = resolve;
        }),
    );
    const scanned = scan.scan([at('A.excalidraw', 1)]);
    scan.saved(at('A.excalidraw', 2), []);
    finishRead(success('old'));
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
});
