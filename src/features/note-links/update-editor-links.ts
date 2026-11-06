import type { Editor } from '@tiptap/core';
import { renamedLink, type LinkRename } from './NoteLinkRewriter';

export function updateEditorLinks(editor: Editor, renames: readonly LinkRename[]) {
  const transaction = editor.state.tr;
  editor.state.doc.descendants((node, position) => {
    if (node.type.name !== 'noteLink') return;
    let path = String(node.attrs.path ?? '');
    let label = String(node.attrs.label ?? '');
    for (const rename of renames) {
      const next = renamedLink(path, label, rename);
      if (next) {
        path = next.path;
        label = next.text;
      }
    }
    if (path !== node.attrs.path || label !== node.attrs.label)
      transaction.setNodeMarkup(position, undefined, { ...node.attrs, path, label });
  });
  if (transaction.docChanged)
    editor.view.dispatch(transaction.setMeta('preventUpdate', true).setMeta('addToHistory', false));
}
