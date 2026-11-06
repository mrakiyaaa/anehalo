import type { NoteSummary } from '@/types/notes';

function matchScore(title: string, query: string): number | null {
  const text = title.toLocaleLowerCase();
  if (text === query) return 0;
  if (text.startsWith(query)) return 1;
  const substring = text.indexOf(query);
  if (substring >= 0) return 2 + substring / 1000;
  let position = -1;
  let gaps = 0;
  for (const character of query) {
    const next = text.indexOf(character, position + 1);
    if (next < 0) return null;
    gaps += next - position - 1;
    position = next;
  }
  return 10 + gaps;
}
export function filterNotes(notes: readonly NoteSummary[], query: string): readonly NoteSummary[] {
  const normalized = query.trim().toLocaleLowerCase();
  return notes
    .map((note) => ({ note, score: normalized ? matchScore(note.title, normalized) : 0 }))
    .filter((match): match is { note: NoteSummary; score: number } => match.score !== null)
    .sort(
      (first, second) =>
        first.score - second.score ||
        second.note.modifiedAt - first.note.modifiedAt ||
        first.note.title.localeCompare(second.note.title),
    )
    .map(({ note }) => note);
}
