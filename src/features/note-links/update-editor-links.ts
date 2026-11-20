import type { Editor } from '@tiptap/core';
import { renamedLink, type LinkRename } from './NoteLinkRewriter';

/** The text attribute each linking node shows: a link's label, or an embed's title. */
const textAttributes: Readonly<Record<string, string>> = {
  noteLink: 'label',
  diagramEmbed: 'title',
};

export function updateEditorLinks(editor: Editor, renames: readonly LinkRename[]) {
  const transaction = editor.state.tr;
  editor.state.doc.descendants((node, position) => {
    const textAttribute = textAttributes[node.type.name];
    if (!textAttribute) return;
    let path = String(node.attrs.path ?? '');
    let text = String(node.attrs[textAttribute] ?? '');
    for (const rename of renames) {
      const next = renamedLink(path, text, rename);
      if (next) {
        path = next.path;
        text = next.text;
      }
    }
    if (path !== node.attrs.path || text !== node.attrs[textAttribute])
      transaction.setNodeMarkup(position, undefined, {
        ...node.attrs,
        path,
        [textAttribute]: text,
      });
  });
  if (transaction.docChanged)
    editor.view.dispatch(transaction.setMeta('preventUpdate', true).setMeta('addToHistory', false));
}
