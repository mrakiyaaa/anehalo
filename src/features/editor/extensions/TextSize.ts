import { Mark } from '@tiptap/core';
import { isTextSize, type TextSizeName } from '@/features/editor/formatting-options';
import { htmlMarkTokenizer } from './html-mark-tokenizer';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    textSize: { setTextSize: (size: TextSizeName) => ReturnType };
  }
}

export const TextSize = Mark.create({
  name: 'textSize',
  addAttributes: () => ({ size: { default: null, rendered: false } }),
  parseHTML: () => [
    {
      tag: 'span[data-size]',
      getAttrs: (element) =>
        isTextSize(element.dataset.size) ? { size: element.dataset.size } : false,
    },
  ],
  renderHTML: ({ mark }) => [
    'span',
    isTextSize(mark.attrs.size) ? { 'data-size': mark.attrs.size } : {},
    0,
  ],
  markdownTokenizer: htmlMarkTokenizer('textSize', 'span', 'size'),
  parseMarkdown: (token, helpers) =>
    isTextSize(token.value)
      ? helpers.applyMark('textSize', helpers.parseInline(token.tokens ?? []), {
          size: token.value,
        })
      : helpers.parseInline(token.tokens ?? []),
  renderMarkdown: (node, helpers) =>
    isTextSize(node.attrs?.size)
      ? `<span data-size="${node.attrs.size}">${helpers.renderChildren(node)}</span>`
      : helpers.renderChildren(node),
  addCommands() {
    return {
      setTextSize:
        (size) =>
        ({ commands }) =>
          size === 'normal'
            ? commands.unsetMark(this.name)
            : isTextSize(size) && commands.setMark(this.name, { size }),
    };
  },
});
