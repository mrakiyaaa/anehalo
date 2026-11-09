import {
  DEFAULT_NOTE_TITLE,
  MAXIMUM_NAME_LENGTH,
  cleanNoteTitle,
  withoutInvalidCharacters,
} from '@/features/storage/note-names';

function renamedTo(title: string, reason: string): string {
  return `Renamed to ${title} (${reason})`;
}

/**
 * Explains why the saved title differs from what the user typed, or returns null when the
 * saved title is what they asked for. Used after the title field loses focus.
 */
export function describeTitleChange(typed: string, saved: string): string | null {
  const wanted = cleanNoteTitle(typed);
  // An emptied field is meant to become "Untitled note"; only a taken name needs explaining.
  if (!wanted) return saved === DEFAULT_NOTE_TITLE ? null : renamedTo(saved, 'name already used');
  if (saved !== wanted) return renamedTo(saved, 'name already used');
  const asTyped = typed.replace(/\.md$/i, '').normalize('NFC').trim();
  if (asTyped === saved) return null;
  return [...withoutInvalidCharacters(asTyped)].length > MAXIMUM_NAME_LENGTH
    ? renamedTo(saved, `name shortened to ${MAXIMUM_NAME_LENGTH} characters`)
    : renamedTo(saved, 'invalid characters removed');
}
