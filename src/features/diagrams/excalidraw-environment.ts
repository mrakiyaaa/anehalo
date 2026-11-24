declare global {
  interface Window {
    EXCALIDRAW_ASSET_PATH?: string;
    EXCALIDRAW_EXPORT_SOURCE?: string;
  }
}

/** Where scripts/copy-excalidraw-assets.mjs puts Excalidraw's fonts inside the app bundle. */
export const excalidrawAssetPath = `${import.meta.env.BASE_URL}excalidraw/`;

/** Written into every saved file's "source" field, as excalidraw.com writes its own URL. */
export const DIAGRAM_SOURCE = 'https://github.com/mrakiyaaa/anehalo';

// Excalidraw reads these globals, some only once when its code first runs, so this module is
// loaded at startup (it holds no Excalidraw code) and imported first by every Excalidraw user.
// Without the asset path, fonts would come from a public CDN.
window.EXCALIDRAW_ASSET_PATH = excalidrawAssetPath;
window.EXCALIDRAW_EXPORT_SOURCE = DIAGRAM_SOURCE;

// Excalidraw's own "Save to disk" (a command-palette entry and Ctrl+Shift+S) would open the
// browser's save picker or start a download, around Anehalo's Export. A picker that always
// refuses, the way a cancelled one does, turns it off for good. Excalidraw's file library
// decides at load time whether pickers exist, so this must be set before it loads.
Object.defineProperty(window, 'showSaveFilePicker', {
  configurable: true,
  value: () => Promise.reject(new DOMException('Saving files is done from Export.', 'AbortError')),
});
