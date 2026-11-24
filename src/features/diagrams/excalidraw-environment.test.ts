import { describe, expect, it } from 'vitest';
import './excalidraw-environment';

describe('Excalidraw environment', () => {
  it('turns Excalidraw’s own save-to-disk into a cancelled save, never a picker or a download', async () => {
    const picker = (window as unknown as { showSaveFilePicker: () => Promise<unknown> })
      .showSaveFilePicker;
    await expect(picker()).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('points Excalidraw at the bundled fonts, not a CDN', () => {
    expect(window.EXCALIDRAW_ASSET_PATH).toBe(`${import.meta.env.BASE_URL}excalidraw/`);
  });
});
