import { Mark } from '@tiptap/core';
import { isTextColor, type TextColorName } from '@/features/editor/formatting-options';
import { htmlMarkTokenizer } from './html-mark-tokenizer';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    textColor: { setTextColor: (color: TextColorName | null) => ReturnType };
  }
}

export const TextColor = Mark.create({
  name: 'textColor',
  addAttributes: () => ({ color: { default: null, rendered: false } }),
  parseHTML: () => [
    {
      tag: 'span[data-color]',
      getAttrs: (element) =>
        isTextColor(element.dataset.color) ? { color: element.dataset.color } : false,
    },
  ],
  renderHTML: ({ mark }) => [
    'span',
    isTextColor(mark.attrs.color) ? { 'data-color': mark.attrs.color } : {},
    0,
  ],
  markdownTokenizer: htmlMarkTokenizer('textColor', 'span', 'color'),
  parseMarkdown: (token, helpers) =>
    isTextColor(token.value)
      ? helpers.applyMark('textColor', helpers.parseInline(token.tokens ?? []), {
          color: token.value,
        })
      : helpers.parseInline(token.tokens ?? []),
  renderMarkdown: (node, helpers) =>
    isTextColor(node.attrs?.color)
      ? `<span data-color="${node.attrs.color}">${helpers.renderChildren(node)}</span>`
      : helpers.renderChildren(node),
  addCommands() {
    return {
      setTextColor:
        (color) =>
        ({ commands }) =>
          color === null
            ? commands.unsetMark(this.name)
            : isTextColor(color) && commands.setMark(this.name, { color }),
    };
  },
});
