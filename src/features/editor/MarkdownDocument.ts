import type { Editor } from '@tiptap/core';

export class MarkdownDocument {
  private readonly originalDocument: string;
  constructor(
    private readonly originalMarkdown: string,
    editor: Editor,
  ) {
    this.originalDocument = JSON.stringify(editor.getJSON());
  }

  serialize(editor: Editor): string {
    // Preserve the source's whitespace and Markdown spelling until its document changes.
    return JSON.stringify(editor.getJSON()) === this.originalDocument
      ? this.originalMarkdown
      : editor.getMarkdown();
  }
}
