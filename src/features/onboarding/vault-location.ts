import { failure, success, type RepositoryResult } from '@/features/storage/repository-result';

export interface VaultLocationInspection {
  readonly locationType: 'directory' | 'file' | 'link' | 'missing';
  readonly vaultType: 'directory' | 'file' | 'link' | 'missing';
  readonly writable: boolean;
}

function pathParts(path: string) {
  return path.replaceAll('\\', '/').split('/').filter(Boolean);
}

export function resolveVaultPath(pickedFolder: string): string {
  const trimmed = pickedFolder.replace(/[\\/]+$/, '');
  if (pathParts(trimmed).at(-1)?.toLowerCase() === 'anehalo') return trimmed;
  return `${trimmed}${pickedFolder.includes('\\') ? '\\' : '/'}Anehalo`;
}

export function validateVaultLocation(
  pickedFolder: string,
  inspection?: VaultLocationInspection,
): RepositoryResult<void> {
  const parts = pathParts(pickedFolder);
  if (
    !pickedFolder.trim() ||
    /[<>"|?*]/u.test(pickedFolder) ||
    Array.from(pickedFolder).some((character) => character.charCodeAt(0) < 32) ||
    parts.some((part) => part === '.' || part === '..')
  )
    return failure({ code: 'invalid-path', message: 'Choose a valid folder location.' });
  if (
    /^[a-z]:[\\/]*$/i.test(pickedFolder) ||
    /^[/\\]+$/.test(pickedFolder) ||
    /^\\\\[^\\]+\\[^\\]+[\\]*$/.test(pickedFolder)
  )
    return failure({
      code: 'invalid-path',
      message: 'Choose a folder inside a drive or network share, not its root.',
    });
  if (
    parts.some((part) => /^(windows|program files(?: \(x86\))?|programdata|appdata)$/i.test(part))
  )
    return failure({
      code: 'invalid-path',
      message: 'Choose a personal folder outside Windows, Program Files, ProgramData, and AppData.',
    });
  if (resolveVaultPath(pickedFolder).length > 240)
    return failure({
      code: 'path-too-long',
      message: 'This folder path is too long. Choose a location closer to the drive root.',
    });
  if (inspection) {
    if (inspection.locationType === 'missing')
      return failure({
        code: 'not-found',
        message: 'The selected folder is missing. Choose an existing location.',
      });
    if (inspection.locationType !== 'directory' || inspection.vaultType === 'link')
      return failure({
        code: 'invalid-path',
        message: 'Choose a real folder, not a file, symbolic link, or junction.',
      });
    if (inspection.vaultType === 'file')
      return failure({
        code: 'invalid-type',
        message: 'A file named Anehalo already exists here. Choose another location.',
      });
    if (!inspection.writable)
      return failure({
        code: 'permission-denied',
        message: 'This folder is not writable. Choose another location or check its permissions.',
      });
  }
  return success(undefined);
}

export function validateSavedVaultPath(path: string): RepositoryResult<void> {
  const valid = validateVaultLocation(path);
  if (!valid.ok) return valid;
  if (pathParts(path).at(-1)?.toLowerCase() !== 'anehalo')
    return failure({
      code: 'legacy-vault',
      message:
        'This saved location is not an Anehalo vault. Choose a folder again. Your existing files have not been moved or changed.',
    });
  return success(undefined);
}
