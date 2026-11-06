import { failure, success, type RepositoryResult } from '@/features/storage/repository-result';

export const defaultQuickNoteShortcut = 'Ctrl+Alt+N';
export function validateShortcut(shortcut: string): RepositoryResult<string> {
  const parts = shortcut.split('+').map((part) => part.trim());
  const key = parts.pop() ?? '';
  const aliases: Record<string, string> = {
    ctrl: 'Ctrl',
    control: 'Ctrl',
    alt: 'Alt',
    shift: 'Shift',
    meta: 'Super',
    super: 'Super',
    win: 'Super',
  };
  const modifiers = parts.map((part) => aliases[part.toLowerCase()]);
  const normalizedKey = key.length === 1 ? key.toUpperCase() : key;
  if (
    !modifiers.length ||
    modifiers.some((modifier) => !modifier) ||
    new Set(modifiers).size !== modifiers.length ||
    !/^(?:[A-Z0-9]|F(?:[1-9]|1[0-9]|2[0-4])|Space|Enter|Tab|Escape|Backspace|Delete|Insert|Home|End|PageUp|PageDown|ArrowUp|ArrowDown|ArrowLeft|ArrowRight)$/.test(
      normalizedKey,
    )
  )
    return failure({
      code: 'invalid-name',
      message: 'Choose at least one modifier (Ctrl, Alt, Shift) and a key.',
    });
  const has = (modifier: string) => modifiers.includes(modifier);
  if (
    has('Super') ||
    (has('Alt') && ['Tab', 'Escape', 'F4', 'Space', 'Enter'].includes(normalizedKey)) ||
    (has('Ctrl') && ['Escape', 'Tab'].includes(normalizedKey)) ||
    (has('Ctrl') && has('Alt') && normalizedKey === 'Delete') ||
    (has('Ctrl') && !has('Alt') && !has('Shift') && ['K', 'F'].includes(normalizedKey))
  )
    return failure({
      code: 'invalid-name',
      message: 'That shortcut is reserved by Windows or Anehalo. Choose another combination.',
    });
  return success([...['Ctrl', 'Alt', 'Shift'].filter(has), normalizedKey].join('+'));
}

export function shortcutFromEvent(
  event: Pick<KeyboardEvent, 'ctrlKey' | 'altKey' | 'shiftKey' | 'metaKey' | 'code' | 'key'>,
): string | null {
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) return null;
  const key = /^(Key|Digit)/.test(event.code)
    ? event.code.replace(/^(Key|Digit)/, '')
    : event.code === 'Space'
      ? 'Space'
      : event.key;
  return [
    ...(event.ctrlKey ? ['Ctrl'] : []),
    ...(event.altKey ? ['Alt'] : []),
    ...(event.shiftKey ? ['Shift'] : []),
    ...(event.metaKey ? ['Super'] : []),
    key,
  ].join('+');
}
