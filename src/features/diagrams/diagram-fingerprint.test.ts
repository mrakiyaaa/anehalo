import { describe, expect, it } from 'vitest';
import type { DiagramScene } from './diagram-codec';
import { diagramFingerprint } from './diagram-fingerprint';

/** Mirrors Excalidraw's hashElementsVersion: it changes when any element's version does. */
const hashVersions = (elements: DiagramScene['elements']) =>
  elements.reduce((sum, element, index) => sum + element.version * (index + 1), 0);

function scene(overrides: Partial<Record<string, unknown>> = {}): DiagramScene {
  return {
    elements: [
      { id: 'box', type: 'rectangle', version: 1, isDeleted: false },
      { id: 'photo', type: 'image', version: 1, isDeleted: false, fileId: 'file-1' },
    ],
    appState: {
      viewBackgroundColor: '#ffffff',
      gridModeEnabled: false,
      gridSize: 20,
      gridStep: 5,
      zoom: { value: 1 },
      scrollX: 0,
      scrollY: 0,
      selectedElementIds: {},
      activeTool: { type: 'selection' },
    },
    files: { 'file-1': { id: 'file-1', mimeType: 'image/png', dataURL: 'data:', created: 1 } },
    ...overrides,
  } as unknown as DiagramScene;
}

const fingerprint = (value: DiagramScene) => diagramFingerprint(value, hashVersions);

describe('diagram fingerprint', () => {
  const baseline = fingerprint(scene());

  it.each([
    ['zoom', { zoom: { value: 2 } }],
    ['scroll', { scrollX: 400, scrollY: -120 }],
    ['selection', { selectedElementIds: { box: true } }],
    ['active tool', { activeTool: { type: 'rectangle' } }],
  ])('ignores %s, which is not part of the document', (_name, appStateChange) => {
    const changed = scene({ appState: { ...scene().appState, ...appStateChange } });
    expect(fingerprint(changed)).toBe(baseline);
  });

  it('changes when an element changes', () => {
    const changed = scene();
    const elements = changed.elements.map((element) =>
      element.id === 'box' ? { ...element, version: 2 } : element,
    );
    expect(fingerprint({ ...changed, elements })).not.toBe(baseline);
  });

  it('changes when the background colour or grid changes', () => {
    const changed = scene();
    expect(
      fingerprint({
        ...changed,
        appState: { ...changed.appState, viewBackgroundColor: '#fffce8' },
      }),
    ).not.toBe(baseline);
    expect(
      fingerprint({ ...changed, appState: { ...changed.appState, gridModeEnabled: true } }),
    ).not.toBe(baseline);
  });

  it('changes when an image’s data arrives after its element', () => {
    expect(fingerprint(scene({ files: {} }))).not.toBe(baseline);
  });
});
