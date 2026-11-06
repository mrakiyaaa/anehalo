import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node } from '@tiptap/pm/model';
import { matchingRanges } from './search-text';

export interface FindState {
  query: string;
  selected: number;
  matches: { from: number; to: number }[];
}
export const findKey = new PluginKey<FindState>('noteFind');
export function findMatches(document: Node, query: string) {
  const matches: FindState['matches'] = [];
  if (!query.trim()) return matches;
  document.descendants((node, position) => {
    if (!node.isTextblock) return;
    let text = '';
    const positions: number[] = [];
    node.descendants((child, offset) => {
      const content = child.isText ? (child.text ?? '') : child.isLeaf ? '\ufffc' : '';
      for (let index = 0; index < content.length; index++)
        positions.push(position + 1 + offset + index);
      text += content;
    });
    for (const range of matchingRanges(text, query)) {
      const from = positions[range.start];
      const end = positions[range.end - 1];
      if (from !== undefined && end !== undefined) matches.push({ from, to: end + 1 });
    }
    return false;
  });
  return matches;
}

export function moveFindMatch(selected: number, direction: number, count: number) {
  return count ? (selected + direction + count) % count : 0;
}

export const FindExtension = Extension.create({
  name: 'noteFind',
  addProseMirrorPlugins() {
    return [
      new Plugin<FindState>({
        key: findKey,
        state: {
          init: () => ({ query: '', selected: 0, matches: [] }),
          apply(transaction, previous) {
            const action = transaction.getMeta(findKey) as
              Partial<Pick<FindState, 'query' | 'selected'>> | undefined;
            if (!transaction.docChanged && !action) return previous;
            const query = action?.query ?? previous.query;
            const matches = findMatches(transaction.doc, query);
            return {
              query,
              matches,
              selected: Math.min(
                action?.selected ?? previous.selected,
                Math.max(0, matches.length - 1),
              ),
            };
          },
        },
        props: {
          decorations(state) {
            const found = findKey.getState(state);
            return DecorationSet.create(
              state.doc,
              found?.matches.map((match, index) =>
                Decoration.inline(match.from, match.to, {
                  class: index === found.selected ? 'find-match find-current' : 'find-match',
                }),
              ) ?? [],
            );
          },
        },
      }),
    ];
  },
});
