import type { Folder } from '@/types/notes';

const pathCollator = new Intl.Collator(undefined, { numeric: true });

export function compareFolderPaths(first: Folder, second: Folder): number {
  return pathCollator.compare(first.relativePath, second.relativePath);
}
