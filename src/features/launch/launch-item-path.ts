import {
  describeStorageError,
  failure,
  success,
  type RepositoryResult,
} from '@/features/storage/repository-result';
import { validateRelativePath } from '@/features/storage/storage-paths';
import { itemKind } from '@/features/storage/vault-items';

/**
 * The vault-relative path of a note or diagram given to --open, which may be absolute (as
 * File Explorer passes it) or already relative to the vault.
 */
export function launchItemPath(vaultPath: string, path: string): RepositoryResult<string> {
  const vault = vaultPath.replaceAll('\\', '/').replace(/\/+$/, '');
  const normalized = path.replaceAll('\\', '/');
  const isAbsolute = /^[a-z]:\//i.test(normalized) || normalized.startsWith('//');
  // Windows paths are case-insensitive, so the vault prefix is compared that way too.
  if (isAbsolute && !normalized.toLowerCase().startsWith(`${vault.toLowerCase()}/`))
    return failure({ code: 'invalid-path', message: 'Anehalo can only open files in your vault.' });
  const relative = isAbsolute ? normalized.slice(vault.length + 1) : normalized;
  try {
    validateRelativePath(relative);
  } catch (error) {
    return failure(describeStorageError(error, 'Anehalo can only open files in your vault.'));
  }
  if (!itemKind(relative))
    return failure({
      code: 'invalid-name',
      message: 'Anehalo opens .md notes and .excalidraw diagrams.',
    });
  return success(relative);
}
