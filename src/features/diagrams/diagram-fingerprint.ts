import type { DiagramScene } from './diagram-codec';

/** App state that is part of the document; Excalidraw keeps these when exporting a file. */
const documentAppStateKeys = [
  'viewBackgroundColor',
  'gridModeEnabled',
  'gridSize',
  'gridStep',
] as const;

/**
 * A cheap summary of what would be saved. Excalidraw reports every pointer move, zoom, scroll and
 * selection; only a different fingerprint means the document itself changed. The element hash
 * is Excalidraw's own (hashElementsVersion), passed in so this stays free of Excalidraw imports.
 */
export function diagramFingerprint(
  scene: DiagramScene,
  hashElements: (elements: DiagramScene['elements']) => number,
): string {
  const fileIds = scene.elements
    .flatMap((element) =>
      element.type === 'image' &&
      !element.isDeleted &&
      element.fileId &&
      scene.files[element.fileId]
        ? [element.fileId]
        : [],
    )
    .sort();
  const appState = documentAppStateKeys.map((key) => scene.appState[key] ?? null);
  return JSON.stringify([hashElements(scene.elements), fileIds, appState]);
}
