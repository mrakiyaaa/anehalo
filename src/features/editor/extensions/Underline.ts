import BaseUnderline from '@tiptap/extension-underline';

export const Underline = BaseUnderline.extend({
  renderMarkdown: (node, helpers) => `<u>${helpers.renderChildren(node)}</u>`,
});
