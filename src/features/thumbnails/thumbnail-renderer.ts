import type { DiagramScene } from '@/features/diagrams/diagram-codec';
import type { Thumbnail } from './thumbnail-cache';

/** Cards are at most 480 px wide; images are drawn at 2× for high-DPI screens. */
export const THUMBNAIL_PIXEL_WIDTH = 960;
const THUMBNAIL_PIXEL_HEIGHT = 720;

export type ThumbnailRenderer = (scene: DiagramScene) => Promise<Thumbnail>;

/**
 * Excalidraw's typings re-export exportToBlob from an internal package path that does not
 * resolve, so the part of its signature used here is declared.
 */
interface ExcalidrawExport {
  exportToBlob: (options: {
    elements: DiagramScene['elements'];
    files: DiagramScene['files'];
    appState: { exportBackground: boolean; exportWithDarkMode: boolean };
    exportPadding: number;
    mimeType: string;
    quality: number;
    getDimensions: (
      width: number,
      height: number,
    ) => {
      width: number;
      height: number;
      scale: number;
    };
  }) => Promise<Blob>;
}

/**
 * Draws a diagram as a light-theme image on a transparent background; dark mode inverts it with
 * Excalidraw's own filter instead of keeping a second image. Excalidraw is imported here only on
 * demand, so it never loads at startup.
 */
export const renderThumbnail: ThumbnailRenderer = async (scene) => {
  const elements = scene.elements.filter((element) => !element.isDeleted);
  if (elements.length === 0) return { state: 'empty' };
  await import('@/features/diagrams/excalidraw-environment');
  const { exportToBlob } = (await import('@excalidraw/excalidraw')) as unknown as ExcalidrawExport;
  const blob = await exportToBlob({
    elements,
    files: scene.files,
    appState: { exportBackground: false, exportWithDarkMode: false },
    exportPadding: 16,
    mimeType: 'image/webp',
    quality: 0.85,
    getDimensions: (width: number, height: number) => {
      const scale = Math.min(2, THUMBNAIL_PIXEL_WIDTH / width, THUMBNAIL_PIXEL_HEIGHT / height);
      return { width: Math.round(width * scale), height: Math.round(height * scale), scale };
    },
  });
  // A canvas that cannot encode WebP falls back to PNG, so the type comes from the blob.
  return { state: 'image', bytes: new Uint8Array(await blob.arrayBuffer()), mimeType: blob.type };
};
