import './excalidraw-environment';
import { restore, serializeAsJSON } from '@excalidraw/excalidraw';
import type { ImportedDataState } from '@excalidraw/excalidraw/data/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { AppState, BinaryFileData, BinaryFiles } from '@excalidraw/excalidraw/types';
import { defaultScanScheduling } from '@/features/storage/ScanBudget';
import { DiagramParseError } from './diagram-errors';

export interface DiagramScene {
  readonly elements: readonly ExcalidrawElement[];
  readonly appState: Partial<AppState>;
  readonly files: BinaryFiles;
}

interface ExcalidrawFile {
  readonly type: 'excalidraw';
  readonly elements: readonly unknown[];
  readonly appState?: unknown;
  readonly files?: unknown;
}

function isExcalidrawFile(data: unknown): data is ExcalidrawFile {
  return (
    typeof data === 'object' &&
    data !== null &&
    'type' in data &&
    data.type === 'excalidraw' &&
    'elements' in data &&
    Array.isArray(data.elements)
  );
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Reads a .excalidraw file. Excalidraw's own restore upgrades older and foreign files and keeps
 * images whose data is missing as placeholders, so only unreadable files fail.
 */
export function parseDiagram(text: string): DiagramScene {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new DiagramParseError(`Invalid JSON: ${describe(error)}`);
  }
  if (!isExcalidrawFile(data))
    throw new DiagramParseError('The file is not an Excalidraw drawing.');
  try {
    // restore() is built to clean up arbitrary imported data, so it receives the raw values.
    const imported = data as unknown as ImportedDataState;
    const restored = restore(
      {
        elements: imported.elements ?? [],
        appState: imported.appState ?? {},
        files: imported.files ?? {},
      },
      null,
      null,
      { repairBindings: true },
    );
    return { elements: restored.elements, appState: restored.appState, files: restored.files };
  } catch (error) {
    throw new DiagramParseError(`The drawing could not be restored: ${describe(error)}`);
  }
}

/** Images never change once added, so each one is serialized only once per session. */
const serializedFiles = new WeakMap<BinaryFileData, string>();

function referencedFiles(scene: DiagramScene): BinaryFileData[] {
  const files: BinaryFileData[] = [];
  const seen = new Set<string>();
  for (const element of scene.elements) {
    if (element.type !== 'image' || element.isDeleted || !element.fileId) continue;
    const file = scene.files[element.fileId];
    if (file && !seen.has(file.id)) {
      seen.add(file.id);
      files.push(file);
    }
  }
  return files;
}

const emptyFilesField = '"files": {}';

function withFiles(json: string, fragments: readonly string[]): string {
  const index = json.lastIndexOf(emptyFilesField);
  if (index < 0) throw new Error('Excalidraw no longer writes an empty "files" field.');
  return `${json.slice(0, index)}"files": {${fragments.join(',')}}${json.slice(index + emptyFilesField.length)}`;
}

/**
 * Serializes with Excalidraw's own serializer in local mode, which keeps images inside the file.
 * Large images are added separately, yielding between them, so saving a heavy diagram never
 * freezes a frame for long.
 */
export async function serializeDiagram(
  scene: DiagramScene,
  yieldToInput: () => Promise<void> = defaultScanScheduling.yieldToInput,
): Promise<string> {
  const withoutFiles = serializeAsJSON(scene.elements, scene.appState, {}, 'local');
  const fragments: string[] = [];
  for (const file of referencedFiles(scene)) {
    let fragment = serializedFiles.get(file);
    if (fragment === undefined) {
      await yieldToInput();
      fragment = `${JSON.stringify(file.id)}: ${JSON.stringify(file)}`;
      serializedFiles.set(file, fragment);
    }
    fragments.push(fragment);
  }
  return withFiles(withoutFiles, fragments);
}

export function emptyDiagramText(): string {
  return serializeAsJSON([], {}, {}, 'local');
}
