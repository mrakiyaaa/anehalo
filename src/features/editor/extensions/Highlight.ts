import BaseHighlight from '@tiptap/extension-highlight';
import { htmlMarkTokenizer } from './html-mark-tokenizer';

export const Highlight = BaseHighlight.extend({
  markdownTokenizer: htmlMarkTokenizer('highlight', 'mark'),
  renderMarkdown: (node, helpers) => `<mark>${helpers.renderChildren(node)}</mark>`,
});
