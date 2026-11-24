import { diagramTitle } from '@/features/storage/note-names';
import { StorageFailure } from '@/features/storage/repository-result';

export type ImportFileKind = 'excalidraw' | 'png' | 'svg';

const kindsByExtension: Readonly<Record<string, ImportFileKind>> = {
  '.excalidraw': 'excalidraw',
  '.png': 'png',
  '.svg': 'svg',
};

/** What a file claims to be, from its name alone; null for anything that cannot be imported. */
export function importFileKind(fileName: string): ImportFileKind | null {
  const dot = fileName.lastIndexOf('.');
  if (dot < 0) return null;
  return kindsByExtension[fileName.slice(dot).toLowerCase()] ?? null;
}

/**
 * The title an imported file gets: its name without extension, including the ".excalidraw" that
 * excalidraw.com puts before ".png" and ".svg". Names Windows reserves get an underscore.
 */
export function importTitle(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  const name = (dot >= 0 ? fileName.slice(0, dot) : fileName).replace(/\.excalidraw$/i, '');
  try {
    return diagramTitle(name);
  } catch (error) {
    if (!(error instanceof StorageFailure) || error.storageError.code !== 'invalid-name')
      throw error;
    return diagramTitle(`_${name}`);
  }
}

const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function hasPngSignature(bytes: Uint8Array): boolean {
  return pngSignature.every((byte, index) => bytes[index] === byte);
}

/** Files over this size ask before importing, as copying and indexing them takes a while. */
export const LARGE_IMPORT_BYTES = 50 * 1024 * 1024;
