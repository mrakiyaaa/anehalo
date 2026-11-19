declare global {
  interface Window {
    EXCALIDRAW_ASSET_PATH?: string;
  }
}

/** Where scripts/copy-excalidraw-assets.mjs puts Excalidraw's fonts inside the app bundle. */
export const excalidrawAssetPath = `${import.meta.env.BASE_URL}excalidraw/`;

// Excalidraw reads this when it first loads fonts; without it, fonts come from a public CDN.
window.EXCALIDRAW_ASSET_PATH = excalidrawAssetPath;
