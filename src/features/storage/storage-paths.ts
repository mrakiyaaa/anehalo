import { storageFailure } from '@/features/storage/repository-result';
import { isReservedName } from '@/features/storage/note-names';

export function validateRelativePath(path: string, allowRoot = false, allowHidden = false): string {
  if (path === '' && allowRoot) return '';
  const components = path.split('/');
  if (
    !path ||
    path.includes('\\') ||
    components.some(
      (component) =>
        !component ||
        component === '.' ||
        component === '..' ||
        isReservedName(component) ||
        /[\\:*?"<>|]/.test(component) ||
        /[.\s]$/.test(component) ||
        (!allowHidden && component.startsWith('.')) ||
        [...component].some(
          (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
        ),
    )
  )
    storageFailure(
      'invalid-path',
      'The path must stay inside the vault and cannot reference hidden items.',
    );
  return path;
}

export function parentPath(path: string): string {
  return path.slice(0, Math.max(0, path.lastIndexOf('/')));
}

export function pathName(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}

export function joinRelativePath(parent: string, name: string): string {
  return parent ? `${parent}/${name}` : name;
}

export function isInsideFolder(path: string, folder: string): boolean {
  return path === folder || path.startsWith(`${folder}/`);
}

export function assertInsideVault(vaultPath: string, absolutePath: string): void {
  const normalizedVault = vaultPath.replaceAll('\\', '/').replace(/\/$/, '').toLowerCase();
  const normalizedPath = absolutePath.replaceAll('\\', '/').toLowerCase();
  if (normalizedPath.split('/').some((component) => component === '..' || component === '.'))
    storageFailure('invalid-path', 'The path must be resolved before accessing the vault.');
  if (normalizedPath !== normalizedVault && !normalizedPath.startsWith(`${normalizedVault}/`))
    storageFailure('invalid-path', 'The path resolves outside the vault.');
}
