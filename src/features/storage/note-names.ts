import { storageFailure } from '@/features/storage/repository-result';

export const MAXIMUM_NAME_LENGTH = 80;

export function isReservedName(name: string): boolean {
  return /^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(name);
}

export function sanitizeName(value: string, fallback: string): string {
  const sanitized = [...value.normalize('NFC').replace(/[\\/:*?"<>|]/g, '')]
    .filter((character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127)
    .slice(0, MAXIMUM_NAME_LENGTH)
    .join('')
    .replace(/^[.\s]+|[.\s]+$/g, '');
  const name = sanitized || fallback;
  if (isReservedName(name))
    storageFailure('invalid-name', `“${name}” is reserved by Windows. Choose another name.`);
  return name;
}

export function noteTitle(value: string): string {
  return sanitizeName(value.replace(/\.md$/i, ''), 'Untitled note');
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
