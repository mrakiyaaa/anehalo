import type { PastelTone } from '@/types/notes';

const folderTones: readonly PastelTone[] = ['sky', 'mint', 'lilac', 'peach', 'rose', 'butter'];

export function folderTone(path: string | null): PastelTone {
  const hash = [...(path ?? '')].reduce(
    (total, character) => (total * 31 + character.charCodeAt(0)) >>> 0,
    0,
  );
  return folderTones[hash % folderTones.length] ?? 'sky';
}
