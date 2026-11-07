import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { focusEditorWhenReady } from './focus-editor';

const editors: Editor[] = [];
afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy());
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

function setup() {
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.push(callback);
    return frames.length;
  });
  const host = document.createElement('div');
  document.body.append(host);
  const editor = new Editor({
    element: host,
    extensions: [StarterKit],
    content: '<p>Original text</p>',
    autofocus: false,
    injectCSS: false,
  });
  editors.push(editor);
  return { editor, applyFrame: () => frames.splice(0).forEach((frame) => frame(0)) };
}

describe('deferred editor focus', () => {
  it('respects a title field focused after initialization requested autofocus', () => {
    const { editor, applyFrame } = setup();
    focusEditorWhenReady(editor, true);
    const title = document.createElement('input');
    document.body.append(title);
    title.focus();
    title.value = 'Shared note';
    applyFrame();
    expect(document.activeElement).toBe(title);
    expect(title.value).toBe('Shared note');
    expect(editor.view.hasFocus()).toBe(false);
  });
  it('focuses the end of a newly opened note when no other field is being edited', () => {
    const { editor, applyFrame } = setup();
    focusEditorWhenReady(editor, true);
    applyFrame();
    expect(editor.view.hasFocus()).toBe(true);
    expect(editor.state.selection.from).toBe(editor.state.doc.content.size - 1);
  });
});
