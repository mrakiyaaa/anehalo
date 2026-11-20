import type { DiagramSummary, NoteSummary, VaultTree } from '@/types/notes';
import { compareNoteRecency } from '@/features/storage/note-order';
import { compareDiagramRecency } from '@/features/storage/vault-items';

interface VaultFileItem {
  readonly relativePath: string;
}

/**
 * Hydration reads the whole vault again, which takes a while. Items created, renamed, or
 * removed in the app meanwhile must win over that older reading.
 */
function mergeItems<Item extends VaultFileItem>(
  metadata: readonly Item[],
  current: readonly Item[],
  hydrated: readonly Item[],
  changedLocally: (original: Item, current: Item) => boolean,
): Item[] {
  const baseline = new Map(metadata.map((item) => [item.relativePath, item]));
  const currentPaths = new Set(current.map((item) => item.relativePath));
  const items = new Map(hydrated.map((item) => [item.relativePath, item]));
  for (const path of baseline.keys()) if (!currentPaths.has(path)) items.delete(path);
  for (const item of current) {
    const original = baseline.get(item.relativePath);
    if (!original || changedLocally(original, item)) items.set(item.relativePath, item);
  }
  return [...items.values()];
}

export function mergeHydratedTree(
  metadata: VaultTree,
  current: VaultTree,
  hydrated: VaultTree,
): VaultTree {
  const notes = mergeItems<NoteSummary>(
    metadata.notes,
    current.notes,
    hydrated.notes,
    (original, note) =>
      original.modifiedAt !== note.modifiedAt || original.searchText !== note.searchText,
  );
  const diagrams = mergeItems<DiagramSummary>(
    metadata.diagrams,
    current.diagrams,
    hydrated.diagrams,
    (original, diagram) => original.modifiedAt !== diagram.modifiedAt,
  );
  return {
    ...hydrated,
    notes: notes.sort(compareNoteRecency),
    diagrams: diagrams.sort(compareDiagramRecency),
  };
}
