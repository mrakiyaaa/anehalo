import {
  describeStorageError,
  failure,
  success,
  type RepositoryResult,
} from '@/features/storage/repository-result';
import { validateRelativePath } from '@/features/storage/storage-paths';

export function isNoteReference(reference: string): boolean {
  return !/^[a-z][a-z\d+.-]*:/i.test(reference) && /\.md$/i.test(reference);
}

export function decodeNotePath(reference: string): RepositoryResult<string> {
  try {
    if (!isNoteReference(reference))
      return failure({ code: 'invalid-path', message: 'This is not a note link.' });
    const decoded = decodeURIComponent(reference);
    if (decoded.startsWith('/') || /[?#]/.test(reference))
      return failure({ code: 'invalid-path', message: 'Note links must stay inside the vault.' });
    return success(validateRelativePath(decoded));
  } catch (error) {
    return failure(describeStorageError(error, 'This note link has an invalid path.'));
  }
}

export function encodeNotePath(path: string): string {
  return validateRelativePath(path)
    .split('/')
    .map((part) =>
      encodeURIComponent(part).replace(
        /[!'()*]/g,
        (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
      ),
    )
    .join('/');
}

export function escapeLinkText(text: string): string {
  return text.replace(/[\\[\]*_`~<>]/g, '\\$&').replace(/[\r\n]/g, ' ');
}
