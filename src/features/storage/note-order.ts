import type { NoteSummary } from '@/types/notes';

export function compareNoteRecency(first: NoteSummary, second: NoteSummary): number {
  return second.modifiedAt - first.modifiedAt || first.title.localeCompare(second.title);
}
