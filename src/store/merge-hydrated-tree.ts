import type { VaultTree } from '@/types/notes';
import { compareNoteRecency } from '@/features/storage/note-order';

export function mergeHydratedTree(
  metadata: VaultTree,
  current: VaultTree,
  hydrated: VaultTree,
): VaultTree {
  const baseline = new Map(metadata.notes.map((note) => [note.relativePath, note]));
  const currentPaths = new Set(current.notes.map((note) => note.relativePath));
  const notes = new Map(hydrated.notes.map((note) => [note.relativePath, note]));
  for (const path of baseline.keys()) if (!currentPaths.has(path)) notes.delete(path);
  for (const note of current.notes) {
    const original = baseline.get(note.relativePath);
    if (
      !original ||
      original.modifiedAt !== note.modifiedAt ||
      original.searchText !== note.searchText
    )
      notes.set(note.relativePath, note);
  }
  return { ...hydrated, notes: [...notes.values()].sort(compareNoteRecency) };
}
