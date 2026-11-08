import type { Folder, NoteSummary, VaultTree } from '@/types/notes';
import type { VaultFileSystem } from './VaultFileSystem';
import { ScanBudget, defaultScanScheduling, type ScanScheduling } from './ScanBudget';
import { defaultScanLimits, type ScanLimits } from './ScanLimits';
import { createSnippet } from './note-snippet';
import { joinRelativePath, pathName, parentPath, validateRelativePath } from './storage-paths';
import { compareNoteRecency } from './note-order';
import { compareFolderPaths } from './folder-order';
import { storageFailure } from './repository-result';
import { SearchTextProcessor } from '@/features/search/SearchTextProcessor';
import { prepareNotePreview } from './prepare-note-preview';

export async function scanVault(
  files: VaultFileSystem,
  vaultPath: string,
  limits: ScanLimits = defaultScanLimits,
  scheduling: ScanScheduling = defaultScanScheduling,
): Promise<VaultTree> {
  const budget = new ScanBudget(limits, scheduling);
  const folders: Folder[] = [];
  const notes: NoteSummary[] = [];
  const directories = [''];
  const processor = new SearchTextProcessor();
  try {
    while (directories.length) {
      const directory = directories.pop();
      if (directory === undefined) break;
      const entries = await budget.wait(files.readDirectory(directory));
      for (const entry of entries) {
        await budget.entry();
        if (entry.name.startsWith('.') || entry.type === 'link') continue;
        const path = validateRelativePath(joinRelativePath(directory, entry.name));
        if (entry.type === 'directory') {
          folders.push({ name: entry.name, relativePath: path, parent: directory || null });
          directories.push(path);
        } else if (/\.md$/i.test(entry.name)) {
          const metadata = await budget.wait(files.metadata(path));
          if (!metadata || metadata.type !== 'file')
            storageFailure('invalid-type', 'The notes folder changed while it was being read.');
          const content = await budget.wait(files.readText(path));
          const searchText = await prepareNotePreview(content, processor, budget);
          notes.push({
            relativePath: path,
            title: pathName(path).replace(/\.md$/i, ''),
            folder: parentPath(path) || null,
            modifiedAt: metadata.modifiedAt,
            searchText,
            snippet: createSnippet(searchText),
          });
        }
      }
    }
    budget.check();
    folders.sort(compareFolderPaths);
    notes.sort(compareNoteRecency);
    budget.check();
    return { vaultPath, folders, notes };
  } finally {
    processor.cancel();
  }
}
