import { Editor } from '@tiptap/core';
import { afterEach, describe, expect, it } from 'vitest';
import { editorExtensions } from '@/features/editor/editor-extensions';

const editors: Editor[] = [];
function editorFor(content: string) {
  const editor = new Editor({ extensions: editorExtensions(), content, contentType: 'markdown' });
  editors.push(editor);
  return editor;
}
afterEach(() => editors.splice(0).forEach((editor) => editor.destroy()));

function nodesOf(editor: Editor, type: string) {
  const found: Record<string, unknown>[] = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name === type) found.push(node.attrs);
  });
  return found;
}

describe('diagram links and embeds in Markdown', () => {
  it.each([
    ['[Flow](Flow.excalidraw)', 'Flow.excalidraw'],
    ['[My diagram](Work/Plans/My%20diagram.excalidraw)', 'Work/Plans/My diagram.excalidraw'],
    ['[සිංහල](සටහන්/සිංහල%20රූපය.excalidraw)', 'සටහන්/සිංහල රූපය.excalidraw'],
    ['[தமிழ்](குறிப்புகள்/தமிழ்.excalidraw)', 'குறிப்புகள்/தமிழ்.excalidraw'],
  ])('links to a diagram with %s', (source, path) => {
    const editor = editorFor(source);
    expect(nodesOf(editor, 'noteLink')).toEqual([expect.objectContaining({ path })]);
    const serialized = editor.getMarkdown();
    expect(editorFor(serialized).getJSON()).toEqual(editor.getJSON());
  });

  it.each([
    ['![Flow](Flow.excalidraw)', 'Flow.excalidraw', 'Flow'],
    ['![My diagram](Work/My%20diagram.excalidraw)', 'Work/My diagram.excalidraw', 'My diagram'],
    ['![රූපය](සටහන්/සිංහල%20රූපය.excalidraw)', 'සටහන්/සිංහල රූපය.excalidraw', 'රූපය'],
    ['![வரைபடம்](தமிழ்/வரைபடம்.excalidraw)', 'தமிழ்/வரைபடம்.excalidraw', 'வரைபடம்'],
  ])('embeds a diagram with %s and writes it back unchanged', (source, path, title) => {
    const editor = editorFor(source);
    expect(nodesOf(editor, 'diagramEmbed')).toEqual([{ path, title }]);
    // Non-ASCII names are percent-encoded on save, as note links already are.
    expect(decodeURIComponent(editor.getMarkdown().trim())).toBe(decodeURIComponent(source));
    expect(editorFor(editor.getMarkdown()).getJSON()).toEqual(editor.getJSON());
  });

  it('turns an embed inside a sentence into its own block, keeping the text', () => {
    const editor = editorFor('Before ![Flow](Flow.excalidraw) after');
    expect(nodesOf(editor, 'diagramEmbed')).toEqual([{ path: 'Flow.excalidraw', title: 'Flow' }]);
    expect(editor.getText()).toContain('Before');
    expect(editor.getText()).toContain('after');
  });

  it('leaves ordinary images to the image node exactly as before', () => {
    const source = '![Photo](.attachments/photo.png)';
    const editor = editorFor(source);
    expect(nodesOf(editor, 'diagramEmbed')).toEqual([]);
    expect(nodesOf(editor, 'image')).toEqual([
      expect.objectContaining({ src: '.attachments/photo.png', alt: 'Photo' }),
    ]);
    expect(editor.getMarkdown().trim()).toBe(source);
  });

  it('refuses diagram paths outside the vault', () => {
    const editor = editorFor('![Escape](../Secret.excalidraw) [Escape](../Secret.excalidraw)');
    expect(nodesOf(editor, 'diagramEmbed')).toEqual([]);
    expect(nodesOf(editor, 'noteLink')).toEqual([]);
  });
});
