import type { DiagramScene } from '@/features/diagrams/diagram-codec';
import type { Thumbnail } from './thumbnail-cache';

/** Home cards (at most 480 px wide, drawn at 2×) and previews embedded in notes. */
export type ThumbnailSize = 'card' | 'preview';

const pixelBounds: Readonly<Record<ThumbnailSize, { width: number; height: number }>> = {
  card: { width: 960, height: 720 },
  preview: { width: 1_200, height: 1_600 },
};

export type ThumbnailRenderer = (scene: DiagramScene, size: ThumbnailSize) => Promise<Thumbnail>;

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
async function drawDiagram(
  scene: DiagramScene,
  size: ThumbnailSize,
  mimeType: string,
): Promise<Thumbnail> {
  const elements = scene.elements.filter((element) => !element.isDeleted);
  if (elements.length === 0) return { state: 'empty' };
  await import('@/features/diagrams/excalidraw-environment');
  const { exportToBlob } = (await import('@excalidraw/excalidraw')) as unknown as ExcalidrawExport;
  const bounds = pixelBounds[size];
  const blob = await exportToBlob({
    elements,
    files: scene.files,
    appState: { exportBackground: false, exportWithDarkMode: false },
    exportPadding: 16,
    mimeType,
    quality: 0.85,
    getDimensions: (width: number, height: number) => {
      const scale = Math.min(2, bounds.width / width, bounds.height / height);
      return { width: Math.round(width * scale), height: Math.round(height * scale), scale };
    },
  });
  // A canvas that cannot encode WebP falls back to PNG, so the type comes from the blob.
  return { state: 'image', bytes: new Uint8Array(await blob.arrayBuffer()), mimeType: blob.type };
}

export const renderThumbnail: ThumbnailRenderer = (scene, size) =>
  drawDiagram(scene, size, 'image/webp');

/** A PNG at preview size, for exports that must open in any Markdown app or PDF. */
export function renderExportImage(scene: DiagramScene): Promise<Thumbnail> {
  return drawDiagram(scene, 'preview', 'image/png');
}
