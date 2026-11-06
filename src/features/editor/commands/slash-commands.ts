import type { EditorState } from '@tiptap/pm/state';
import { filterEditorCommands } from './editor-commands';

export interface SlashQuery {
  readonly from: number;
  readonly to: number;
  readonly query: string;
}
export function slashQuery(state: EditorState): SlashQuery | null {
  const { $from, empty } = state.selection;
  if (!empty || !$from.parent.isTextblock || $from.parent.type.spec.code) return null;
  const text = $from.parent.textBetween(0, $from.parentOffset, '', '\ufffc');
  if (!text.startsWith('/') || text.length > 80 || text.includes('\ufffc')) return null;
  return { from: $from.start(), to: $from.pos, query: text.slice(1) };
}
export function nextCommandIndex(index: number, key: string, count: number): number {
  if (count === 0) return 0;
  return (index + (key === 'ArrowUp' ? -1 : 1) + count) % count;
}
export { filterEditorCommands };
