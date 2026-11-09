import { storageFailure } from '@/features/storage/repository-result';

export const MAXIMUM_NAME_LENGTH = 80;
export const DEFAULT_NOTE_TITLE = 'Untitled note';

export function isReservedName(name: string): boolean {
  return /^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(name);
}

/** Normalizes the text and drops the characters Windows does not allow in file names. */
export function withoutInvalidCharacters(value: string): string {
  return [...value.normalize('NFC').replace(/[\\/:*?"<>|]/g, '')]
    .filter((character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127)
    .join('');
}

function cleanName(value: string): string {
  return [...withoutInvalidCharacters(value)]
    .slice(0, MAXIMUM_NAME_LENGTH)
    .join('')
    .replace(/^[.\s]+|[.\s]+$/g, '');
}

export function sanitizeName(value: string, fallback: string): string {
  const name = cleanName(value) || fallback;
  if (isReservedName(name))
    storageFailure('invalid-name', `“${name}” is reserved by Windows. Choose another name.`);
  return name;
}

/**
 * The title a note gets from typed text, before duplicate numbering and the "Untitled note"
 * fallback. Empty when nothing usable is left. Unlike noteTitle, it never throws.
 */
export function cleanNoteTitle(value: string): string {
  return cleanName(value.replace(/\.md$/i, ''));
}

export function noteTitle(value: string): string {
  return sanitizeName(value.replace(/\.md$/i, ''), DEFAULT_NOTE_TITLE);
}

export function uniqueName(
  name: string,
  extension: string,
  existingNames: readonly string[],
): string {
  const occupiedNames = new Set(existingNames.map((existing) => existing.toLowerCase()));
  let sequence = 1;
  while (true) {
    const suffix = sequence === 1 ? '' : ` ${sequence}`;
    const candidate = `${[...name]
      .slice(0, MAXIMUM_NAME_LENGTH - suffix.length)
      .join('')
      .trimEnd()}${suffix}${extension}`;
    if (!occupiedNames.has(candidate.toLowerCase())) return candidate;
    sequence += 1;
  }
}
