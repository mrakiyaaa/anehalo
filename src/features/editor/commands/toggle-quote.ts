import type { Editor } from '@tiptap/core';
import { AllSelection, Selection } from '@tiptap/pm/state';

export function toggleQuote(editor: Editor): void {
  if (editor.state.selection instanceof AllSelection) {
    const document = editor.state.doc;
    editor.commands.setTextSelection({
      from: Selection.atStart(document).from,
      to: Selection.atEnd(document).to,
    });
  }
  editor.chain().focus().toggleBlockquote().run();
}
