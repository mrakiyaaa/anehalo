import { afterEach, describe, expect, it, vi } from 'vitest';
import { SearchTextProcessor } from './SearchTextProcessor';
import {
  processSearchText,
  type SearchProcessingRequest,
  type SearchProcessingResponse,
} from './search-processing';

class FakeSearchWorker {
  static latest: FakeSearchWorker | undefined;
  static hold = false;
  onmessage: ((event: MessageEvent<SearchProcessingResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  terminate = vi.fn();
  constructor() {
    FakeSearchWorker.latest = this;
  }
  postMessage(request: SearchProcessingRequest) {
    if (!FakeSearchWorker.hold)
      queueMicrotask(() =>
        this.onmessage?.(new MessageEvent('message', { data: processSearchText(request) })),
      );
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  FakeSearchWorker.hold = false;
});

describe('background search processing', () => {
  it('processes plain multilingual text and highlighted snippets through a worker', async () => {
    vi.stubGlobal('Worker', FakeSearchWorker);
    const processor = new SearchTextProcessor();
    const analyzed = await processor.analyze('Languages', '**සිංහල** [தமிழ்](private.md) café');
    expect(analyzed).toMatchObject({
      kind: 'analyze',
      result: { ok: true, value: { text: 'සිංහල தமிழ் café' } },
    });
    const snippet = await processor.snippet('සිංහල தமிழ் café', 'தமிழ்');
    expect(snippet).toMatchObject({
      kind: 'snippet',
      result: { ok: true, value: { ranges: [{ start: 6, end: 11 }] } },
    });
    processor.cancel();
    expect(FakeSearchWorker.latest?.terminate).toHaveBeenCalledOnce();
  });
  it('returns a typed error when the worker fails instead of rejecting pending searches', async () => {
    vi.stubGlobal('Worker', FakeSearchWorker);
    FakeSearchWorker.hold = true;
    const processor = new SearchTextProcessor();
    const pending = processor.analyze('Note', 'Text');
    FakeSearchWorker.latest?.onerror?.(
      new ErrorEvent('error', { message: 'Worker failed', cancelable: true }),
    );
    expect(await pending).toMatchObject({ result: { ok: false, error: { code: 'io-error' } } });
    expect(FakeSearchWorker.latest?.terminate).toHaveBeenCalledOnce();
  });
  it('settles pending jobs when the vault closes', async () => {
    vi.stubGlobal('Worker', FakeSearchWorker);
    FakeSearchWorker.hold = true;
    const processor = new SearchTextProcessor();
    const pending = processor.analyze('Note', 'Text');
    processor.cancel();
    expect(await pending).toMatchObject({ result: { ok: false, error: { code: 'unavailable' } } });
  });
});
