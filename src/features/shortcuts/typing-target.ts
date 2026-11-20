/**
 * Excalidraw edits text in its own textarea. App shortcuts stay quiet there: Ctrl+Alt is AltGr
 * on many keyboard layouts, so Ctrl+Alt+N or Ctrl+Alt+D can be someone typing a character.
 */
export function isTypingInDiagramText(target: EventTarget | null): boolean {
  return target instanceof HTMLTextAreaElement && target.classList.contains('excalidraw-wysiwyg');
}

/** For global shortcuts, which arrive from the OS rather than as a key event in the window. */
export function isTypingInFocusedDiagramText(): boolean {
  return document.hasFocus() && isTypingInDiagramText(document.activeElement);
}
