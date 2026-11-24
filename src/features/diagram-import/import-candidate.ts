import type { ImportCandidate } from './DiagramImportService';

/** A picked or dropped file as the import service reads it; the original is only read. */
export function candidateFromFile(file: File): ImportCandidate {
  return {
    name: file.name,
    size: file.size,
    bytes: async () => new Uint8Array(await file.arrayBuffer()),
  };
}

export function formatFileSize(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}
