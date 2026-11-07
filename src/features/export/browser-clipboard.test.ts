import { afterEach, describe, expect, it, vi } from 'vitest';
import { writeBrowserClipboard } from './browser-clipboard';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('browser clipboard fallback', () => {
  it('writes plain text and clears its timeout', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await writeBrowserClipboard('A thought');
    expect(writeText).toHaveBeenCalledWith('A thought');
  });

  it('writes both rich and plain formats when supported', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const item = vi.fn(function (this: object) {
      return this;
    });
    vi.stubGlobal('navigator', { clipboard: { write } });
    vi.stubGlobal('ClipboardItem', item);
    await writeBrowserClipboard('Hello', '<b>Hello</b>');
    expect(item).toHaveBeenCalledOnce();
    expect(write).toHaveBeenCalledOnce();
  });

  it('falls back after permission denial, sets both formats, and restores selection and focus', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    });
    const input = document.createElement('button');
    const text = document.createElement('p');
    text.textContent = 'Selection';
    document.body.append(input, text);
    input.focus();
    const range = document.createRange();
    range.selectNodeContents(text);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    const setData = vi.fn();
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: vi.fn(() => {
        const event = new Event('copy', { cancelable: true });
        Object.defineProperty(event, 'clipboardData', { value: { setData } });
        document.dispatchEvent(event);
        return true;
      }),
    });
    await writeBrowserClipboard('Hello', '<b>Hello</b>');
    expect(setData).toHaveBeenCalledWith('text/html', '<b>Hello</b>');
    expect(setData).toHaveBeenCalledWith('text/plain', 'Hello');
    expect(document.activeElement).toBe(input);
    expect(window.getSelection()?.toString()).toBe('Selection');
    input.remove();
    text.remove();
  });

  it('reports an unavailable clipboard explicitly', async () => {
    vi.stubGlobal('navigator', { clipboard: undefined });
    Object.defineProperty(document, 'execCommand', { configurable: true, value: () => false });
    await expect(writeBrowserClipboard('private')).rejects.toThrow('unavailable');
  });

  it('recovers from a clipboard request that never settles', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('navigator', { clipboard: { writeText: () => new Promise<void>(() => {}) } });
    Object.defineProperty(document, 'execCommand', { configurable: true, value: () => true });
    const operation = writeBrowserClipboard('Hello');
    await vi.advanceTimersByTimeAsync(1500);
    await operation;
  });
});
