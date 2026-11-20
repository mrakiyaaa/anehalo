import type { VaultTree } from '@/types/notes';
import { isInsideFolder } from './storage-paths';

export function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** "5 notes · 2 diagrams · 2 folders"; diagrams are left out while there are none. */
export function formatVaultCounts(tree: Pick<VaultTree, 'notes' | 'diagrams' | 'folders'>) {
  return [
    countLabel(tree.notes.length, 'note', 'notes'),
    ...(tree.diagrams.length > 0 ? [countLabel(tree.diagrams.length, 'diagram', 'diagrams')] : []),
    countLabel(tree.folders.length, 'folder', 'folders'),
  ].join(' · ');
}

/** Notes and diagrams in a folder and its subfolders; null counts the whole vault. */
export function countItems(tree: Pick<VaultTree, 'notes' | 'diagrams'>, folder: string | null) {
  if (folder === null) return tree.notes.length + tree.diagrams.length;
  const inside = (item: { relativePath: string }) => isInsideFolder(item.relativePath, folder);
  return tree.notes.filter(inside).length + tree.diagrams.filter(inside).length;
}
