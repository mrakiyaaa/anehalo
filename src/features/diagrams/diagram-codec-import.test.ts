import { describe, expect, it, vi } from 'vitest';

// Excalidraw probes a 2D canvas when it loads; jsdom has none. Importing never draws.
vi.hoisted(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: () => ({}),
  });
});
import excalidrawComExport from './fixtures/excalidraw-com-export.excalidraw?raw';
import legacyVersionOne from './fixtures/legacy-version-1.excalidraw?raw';
import notADrawing from './fixtures/not-a-drawing.excalidraw?raw';
import truncated from './fixtures/truncated.excalidraw?raw';
import { pngImage, svgImage } from '@/test/image-fixtures';
import {
  DiagramImportError,
  noSceneMessage,
} from '@/features/diagram-import/diagram-import-errors';
import { parseDiagram, readImportedDiagram } from './diagram-codec';
import { DiagramParseError } from './diagram-errors';

const bytes = (text: string) => new TextEncoder().encode(text);
const elementIds = (text: string) => parseDiagram(text).elements.map((element) => element.id);

describe('validating a file to import with Excalidraw’s own loaders', () => {
  it('stores a valid .excalidraw file exactly as it is', async () => {
    expect(await readImportedDiagram('excalidraw', bytes(excalidrawComExport))).toBe(
      excalidrawComExport,
    );
  });

  it('accepts a file from an older version of Excalidraw', async () => {
    const text = await readImportedDiagram('excalidraw', bytes(legacyVersionOne));
    expect(text).toBe(legacyVersionOne);
    expect(elementIds(text)).toEqual(['old-box', 'old-text']);
  });

  it('rejects a corrupt, truncated or foreign file', async () => {
    for (const bad of [truncated, notADrawing, '', 'not json at all'])
      await expect(readImportedDiagram('excalidraw', bytes(bad))).rejects.toBeInstanceOf(
        DiagramParseError,
      );
  });

  it('restores the drawing embedded in a PNG', async () => {
    const text = await readImportedDiagram('png', pngImage(excalidrawComExport));
    expect(elementIds(text)).toEqual(elementIds(excalidrawComExport));
    expect(parseDiagram(text).files['file-1']?.mimeType).toBe('image/png');
  });

  it('restores the drawing embedded in an SVG', async () => {
    const text = await readImportedDiagram('svg', svgImage(excalidrawComExport));
    expect(elementIds(text)).toEqual(elementIds(excalidrawComExport));
  });

  it('says a PNG or SVG without a drawing has no diagram data', async () => {
    for (const [kind, image] of [
      ['png', pngImage()],
      ['svg', svgImage()],
    ] as const) {
      const error: unknown = await readImportedDiagram(kind, image).catch(
        (caught: unknown) => caught,
      );
      expect(error).toBeInstanceOf(DiagramImportError);
      expect((error as DiagramImportError).message).toBe(noSceneMessage);
    }
  });

  it('rejects bytes that are not a PNG image, and a damaged PNG, with a message about the image', async () => {
    const message = 'This PNG image is damaged or could not be read.';
    await expect(readImportedDiagram('png', bytes('<svg/>'))).rejects.toMatchObject({ message });
    const damaged = pngImage(excalidrawComExport).slice(0, 40);
    await expect(readImportedDiagram('png', damaged)).rejects.toMatchObject({ message });
    // A bad checksum is how a PNG that was edited by hand or cut short looks: here a byte of the
    // image data (the first chunk after the 8-byte signature and 25-byte header) is changed.
    const corrupted = pngImage(excalidrawComExport);
    corrupted[41] = (corrupted[41] ?? 0) ^ 0xff;
    await expect(readImportedDiagram('png', corrupted)).rejects.toMatchObject({ message });
  });
});
