import {
  describeStorageError,
  failure,
  success,
  type RepositoryResult,
} from '@/features/storage/repository-result';
import { validateRelativePath } from '@/features/storage/storage-paths';

const scheme = /^[a-z][a-z\d+.-]*:/i;

export function isNoteReference(reference: string): boolean {
  return !scheme.test(reference) && /\.md$/i.test(reference);
}

/** A vault-relative reference to a note (.md) or a diagram (.excalidraw). */
export function isItemReference(reference: string): boolean {
  return !scheme.test(reference) && /\.(md|excalidraw)$/i.test(reference);
}

export function decodeNotePath(reference: string): RepositoryResult<string> {
  return isNoteReference(reference)
    ? decodeItemPath(reference)
    : failure({ code: 'invalid-path', message: 'This is not a note link.' });
}

/** Decodes a link to a note or diagram; it must stay inside the vault. */
export function decodeItemPath(reference: string): RepositoryResult<string> {
  try {
    if (!isItemReference(reference))
      return failure({ code: 'invalid-path', message: 'This is not a link to a note or diagram.' });
    const decoded = decodeURIComponent(reference);
    if (decoded.startsWith('/') || /[?#]/.test(reference))
      return failure({ code: 'invalid-path', message: 'Links must stay inside the vault.' });
    return success(validateRelativePath(decoded));
  } catch (error) {
    return failure(describeStorageError(error, 'This link has an invalid path.'));
  }
}

/** Checks a stored path the way it would be read back from Markdown. */
export function validateItemPath(path: string): RepositoryResult<string> {
  return decodeItemPath(encodeURIComponent(path).replaceAll('%2F', '/'));
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
