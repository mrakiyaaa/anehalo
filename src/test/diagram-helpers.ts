import type { DiagramScene } from '@/features/diagrams/diagram-codec';
import { DiagramParseError } from '@/features/diagrams/diagram-errors';
import { DiagramRepository } from '@/features/diagrams/DiagramRepository';
import { InMemoryNoteRepository } from '@/features/storage/InMemoryNoteRepository';
import type { MemoryEntry } from '@/features/storage/InMemoryVaultFileSystem';

export const emptyDiagramFile = '{"type":"excalidraw","elements":[]}';

/** Stands in for Excalidraw's serializer; the real one is covered by diagram-codec.test.ts. */
export const fakeDiagramCodec = {
  emptyDiagramText: () => emptyDiagramFile,
  serializeDiagram: (scene: DiagramScene) =>
    Promise.resolve(JSON.stringify({ type: 'excalidraw', elements: scene.elements })),
  parseDiagram: (text: string): DiagramScene => {
    let data: { type?: string; elements?: DiagramScene['elements'] };
    try {
      data = JSON.parse(text) as typeof data;
    } catch {
      throw new DiagramParseError('Invalid JSON');
    }
    if (data.type !== 'excalidraw' || !data.elements) throw new DiagramParseError('Not a drawing');
    return { elements: data.elements, appState: {}, files: {} };
  },
};

export function sceneWith(...ids: string[]): DiagramScene {
  return {
    elements: ids.map((id) => ({ id, type: 'rectangle' })),
    appState: {},
    files: {},
  } as unknown as DiagramScene;
}

export function diagramFile(...ids: string[]): string {
  return JSON.stringify({ type: 'excalidraw', elements: sceneWith(...ids).elements });
}

/** A vault in memory with both repositories sharing one queue, as in the app. */
export function memoryVault(seed: readonly MemoryEntry[] = [], now: () => number = Date.now) {
  const notes = new InMemoryNoteRepository(seed, now);
  const diagrams = new DiagramRepository(notes.storage, () => Promise.resolve(fakeDiagramCodec));
  return { notes, diagrams, files: notes.memoryFileSystem };
}

/** Edits a file the way another app would: the in-memory vault only replaces files by rename. */
export async function editOutsideAnehalo(
  files: ReturnType<typeof memoryVault>['files'],
  path: string,
  content: string,
) {
  const temporary = `${path}.outside`;
  await files.writeText(temporary, content);
  await files.rename(temporary, path);
}
