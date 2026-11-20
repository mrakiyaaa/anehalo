import { describe, expect, it, vi } from 'vitest';

// Excalidraw probes a 2D canvas when it loads; jsdom has none. Serializing never draws.
vi.hoisted(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: () => ({}),
  });
});
import excalidrawComExport from './fixtures/excalidraw-com-export.excalidraw?raw';
import legacyVersionOne from './fixtures/legacy-version-1.excalidraw?raw';
import missingImageData from './fixtures/missing-image-data.excalidraw?raw';
import truncated from './fixtures/truncated.excalidraw?raw';
import notADrawing from './fixtures/not-a-drawing.excalidraw?raw';
import { emptyDiagramText, parseDiagram, serializeDiagram } from './diagram-codec';
import { DIAGRAM_SOURCE } from './excalidraw-environment';
import { DiagramParseError } from './diagram-errors';

const noWait = () => Promise.resolve();

describe('diagram codec', () => {
  it('reads an excalidraw.com export with frames, bound text, arrows and an image', () => {
    const scene = parseDiagram(excalidrawComExport);

    expect(scene.elements.map((element) => element.type)).toEqual([
      'frame',
      'rectangle',
      'text',
      'ellipse',
      'arrow',
      'image',
    ]);
    expect(scene.appState.viewBackgroundColor).toBe('#fffce8');
    expect(scene.files['file-1']?.mimeType).toBe('image/png');
  });

  it('round-trips a drawing with its image through Excalidraw’s serializer', async () => {
    const original = parseDiagram(excalidrawComExport);

    const text = await serializeDiagram(original, noWait);
    const saved: unknown = JSON.parse(text);
    const reread = parseDiagram(text);

    expect(saved).toMatchObject({ type: 'excalidraw', version: 2, source: DIAGRAM_SOURCE });
    expect(reread.elements.map(({ id, type }) => ({ id, type }))).toEqual(
      original.elements.map(({ id, type }) => ({ id, type })),
    );
    expect(reread.files['file-1']?.dataURL).toBe(original.files['file-1']?.dataURL);
    expect(reread.appState.viewBackgroundColor).toBe('#fffce8');
  });

  it('keeps only images that the drawing still uses', async () => {
    const scene = parseDiagram(excalidrawComExport);
    const withoutImage = {
      ...scene,
      elements: scene.elements.map((element) =>
        element.type === 'image' ? { ...element, isDeleted: true } : element,
      ),
    };

    const saved = JSON.parse(await serializeDiagram(withoutImage, noWait)) as { files: object };

    expect(saved.files).toEqual({});
  });

  it('upgrades an older version-1 file instead of rejecting it', () => {
    const scene = parseDiagram(legacyVersionOne);

    expect(scene.elements.map((element) => element.id)).toEqual(['old-box', 'old-text']);
    expect(scene.elements.every((element) => typeof element.roughness === 'number')).toBe(true);
  });

  it('keeps an image whose data is missing, so it shows as a missing image', () => {
    const scene = parseDiagram(missingImageData);

    expect(scene.elements.some((element) => element.type === 'image')).toBe(true);
    expect(scene.files).toEqual({});
  });

  it.each([
    ['truncated JSON', truncated],
    ['a library file', notADrawing],
    ['plain text', 'Shopping list'],
    ['an empty file', ''],
  ])('rejects %s with a parse error', (_description, text) => {
    expect(() => parseDiagram(text)).toThrow(DiagramParseError);
  });

  it('writes a valid empty drawing for a new diagram', () => {
    expect(parseDiagram(emptyDiagramText()).elements).toEqual([]);
  });
});
