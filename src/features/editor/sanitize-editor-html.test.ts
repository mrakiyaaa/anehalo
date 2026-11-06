import { Editor } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { sanitizeEditorHtml } from './sanitize-editor-html';
import { editorExtensions } from './editor-extensions';

describe('safe editor content', () => {
  it('removes executable HTML, handlers, unsafe links and arbitrary styling', () => {
    const result = sanitizeEditorHtml(
      '<script>alert(1)</script><iframe src="https://example.com"></iframe><p onclick="bad()" style="color:red;background:url(javascript:bad())"><a href="javascript:bad()">Link</a><span data-color="mint" onmouseover="bad()">Safe</span></p>',
    );
    expect(result).not.toMatch(/script|iframe|onclick|onmouseover|javascript|style=/i);
    expect(result).toContain('data-color="mint"');
    expect(result).toContain('Safe');
  });
  it('keeps basic Word formatting and discards its classes, fonts and styles', () => {
    const result = sanitizeEditorHtml(
      '<p class="MsoNormal"><span style="font-family:Calibri;font-size:22pt;font-weight:700;font-style:italic;text-decoration:underline">Formatted</span></p>',
    );
    expect(result).toContain('<strong>');
    expect(result).toContain('<em>');
    expect(result).toContain('<u>');
    expect(result).not.toMatch(/style=|class=|Calibri|22pt/);
  });
  it('never renders unknown Markdown HTML or unsafe images and links as executable elements', () => {
    const editor = new Editor({
      extensions: editorExtensions(),
      content:
        '<script>window.executed=true</script>\n\n<img src="javascript:bad()" onerror="bad()">\n\n![bad](javascript:bad())\n\n<span data-color="red" onclick="bad()">Text</span>',
      contentType: 'markdown',
    });
    try {
      expect(
        editor.view.dom.querySelector('script,iframe,[onclick],[onerror],img[src^="javascript:"]'),
      ).toBeNull();
      expect(editor.getHTML()).not.toContain('onclick=');
    } finally {
      editor.destroy();
    }
  });
});
