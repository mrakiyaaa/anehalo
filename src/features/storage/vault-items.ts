import type { DiagramSummary, NoteSummary, VaultItemKind, VaultTree } from '@/types/notes';
import { parentPath, pathName } from './storage-paths';

export const NOTE_EXTENSION = '.md';
export const DIAGRAM_EXTENSION = '.excalidraw';

const extensions: Readonly<Record<VaultItemKind, string>> = {
  note: NOTE_EXTENSION,
  diagram: DIAGRAM_EXTENSION,
};

/** The kind of a vault file, decided by its extension; anything else is not a vault item. */
export function itemKind(path: string): VaultItemKind | null {
  const name = pathName(path).toLowerCase();
  if (name.endsWith(NOTE_EXTENSION)) return 'note';
  if (name.endsWith(DIAGRAM_EXTENSION)) return 'diagram';
  return null;
}

export function itemExtension(kind: VaultItemKind): string {
  return extensions[kind];
}

/** The title shown for a file: its name without the item's extension. */
export function itemTitle(path: string, kind: VaultItemKind): string {
  const name = pathName(path);
  const extension = itemExtension(kind);
  return name.toLowerCase().endsWith(extension) ? name.slice(0, -extension.length) : name;
}

export function diagramSummary(relativePath: string, modifiedAt: number): DiagramSummary {
  return {
    kind: 'diagram',
    title: itemTitle(relativePath, 'diagram'),
    folder: parentPath(relativePath) || null,
    relativePath,
    modifiedAt,
  };
}

export type VaultItem = (NoteSummary & { readonly kind: 'note' }) | DiagramSummary;

function compareRecency(first: VaultItem, second: VaultItem): number {
  return second.modifiedAt - first.modifiedAt || first.title.localeCompare(second.title);
}

/** Notes and diagrams together, newest first. */
export function vaultItems(tree: VaultTree): VaultItem[] {
  return [...tree.notes.map((note) => ({ ...note, kind: 'note' as const })), ...tree.diagrams].sort(
    compareRecency,
  );
}

export function recentItems(tree: VaultTree, limit: number): VaultItem[] {
  return vaultItems(tree).slice(0, limit);
}

export type ItemCounts = Readonly<Record<VaultItemKind, number>>;

/** Items directly inside each folder ("" is the vault root), counted per kind. */
export function folderItemCounts(tree: VaultTree): ReadonlyMap<string, ItemCounts> {
  const counts = new Map<string, Record<VaultItemKind, number>>();
  for (const item of vaultItems(tree)) {
    const folder = item.folder ?? '';
    const current = counts.get(folder) ?? { note: 0, diagram: 0 };
    current[item.kind] += 1;
    counts.set(folder, current);
  }
  return counts;
}

export function compareDiagramRecency(first: DiagramSummary, second: DiagramSummary): number {
  return compareRecency(first, second);
}
