import { afterEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { writeHtml, writeText } from '@tauri-apps/plugin-clipboard-manager';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { TauriExportPlatform } from './TauriExportPlatform';

vi.mock('@tauri-apps/api/core', () => ({
  isTauri: () => true,
  invoke: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@tauri-apps/api/path', () => ({
  downloadDir: () => Promise.resolve('C:/Downloads'),
  join: (...parts: string[]) => Promise.resolve(parts.join('/')),
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({ save: vi.fn().mockResolvedValue(null) }));
vi.mock('@tauri-apps/plugin-clipboard-manager', () => ({
  writeHtml: vi.fn().mockResolvedValue(undefined),
  writeText: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@tauri-apps/plugin-opener', () => ({
  revealItemInDir: vi.fn().mockResolvedValue(undefined),
}));
afterEach(() => vi.useRealTimers());

describe('native export ports', () => {
  it('defaults the save dialog to Downloads and uses a remembered folder later', async () => {
    const platform = new TauriExportPlatform('C:/Vault');
    await platform.chooseDestination('My note.md', 'md', null);
    expect(save).toHaveBeenCalledWith({
      title: 'Save as Markdown',
      defaultPath: 'C:/Downloads/My note.md',
      filters: [{ name: 'Markdown note', extensions: ['md'] }],
    });
    await platform.chooseDestination('My note.pdf', 'pdf', 'D:/Exports');
    expect(save).toHaveBeenLastCalledWith({
      title: 'Save as PDF',
      defaultPath: 'D:/Exports/My note.pdf',
      filters: [{ name: 'PDF document', extensions: ['pdf'] }],
    });
  });
  it('passes binary output and image metadata to the scoped transaction', async () => {
    const platform = new TauriExportPlatform('C:/Vault');
    expect(
      (
        await platform.writeBundle({
          path: 'D:/Exports/සිංහල.md',
          bytes: new Uint8Array([1, 2]),
          assets: [{ name: 'image.png', bytes: new Uint8Array([3, 4]) }],
        })
      ).ok,
    ).toBe(true);
    const call = vi.mocked(invoke).mock.calls[0];
    expect(call?.[0]).toBe('write_note_export');
    expect(call?.[1]).toEqual(new Uint8Array([1, 2, 3, 4]));
    const headers = call?.[2]?.headers;
    expect(headers).toEqual({
      'x-anehalo-export': encodeURIComponent(
        JSON.stringify({
          path: 'D:/Exports/සිංහල.md',
          contentLength: 2,
          assets: [{ name: 'image.png', length: 2 }],
        }),
      ),
    });
  });
  it('writes Markdown and HTML through the native clipboard plugin', async () => {
    const platform = new TauriExportPlatform('C:/Vault');
    await platform.writeClipboard('# Title');
    expect(writeText).toHaveBeenCalledWith('# Title');
    await platform.writeClipboard('Title', '<h1>Title</h1>');
    expect(writeHtml).toHaveBeenCalledWith('<h1>Title</h1>', 'Title');
  });
  it('retries a temporarily occupied clipboard', async () => {
    vi.useFakeTimers();
    vi.mocked(writeText).mockRejectedValueOnce(new Error('Occupied'));
    const result = new TauriExportPlatform('C:/Vault').writeClipboard('Text');
    await vi.advanceTimersByTimeAsync(80);
    expect((await result).ok).toBe(true);
    expect(writeText).toHaveBeenCalledTimes(2);
  });
  it('returns a clear typed error when native clipboard access stays unavailable', async () => {
    vi.useFakeTimers();
    vi.mocked(writeText).mockRejectedValue(new Error('Unavailable'));
    vi.spyOn(document, 'hasFocus').mockReturnValue(false);
    const result = new TauriExportPlatform('C:/Vault').writeClipboard('Text');
    await vi.advanceTimersByTimeAsync(1000);
    expect(await result).toMatchObject({
      ok: false,
      error: {
        code: 'unavailable',
        message: 'Could not copy the note. The clipboard is busy or unavailable. Try again.',
      },
    });
  });
  it('reveals a successful export with the native opener', async () => {
    await new TauriExportPlatform('C:/Vault').revealFile('D:/Exports/Note.md');
    expect(revealItemInDir).toHaveBeenCalledWith('D:/Exports/Note.md');
  });
});
