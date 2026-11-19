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
