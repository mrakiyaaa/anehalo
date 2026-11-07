import type { Editor } from '@tiptap/core';
import { Selection } from '@tiptap/pm/state';

export function focusEditorWhenReady(editor: Editor, placeAtEnd = false): void {
  // Check focus in the frame that applies it; TipTap's focus command defers a second time.
  requestAnimationFrame(() => {
    if (editor.isDestroyed || !editor.isEditable || editor.view.hasFocus()) return;
    const activeElement = document.activeElement;
    if (
      activeElement instanceof HTMLElement &&
      (activeElement.matches('input, textarea, select') ||
        activeElement.closest('[role="dialog"], [role="alertdialog"]'))
    )
      return;
    if (placeAtEnd)
      editor.view.dispatch(editor.state.tr.setSelection(Selection.atEnd(editor.state.doc)));
    editor.view.focus();
  });
}
