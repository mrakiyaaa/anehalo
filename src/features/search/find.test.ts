import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { describe, expect, it } from 'vitest';
import { FindExtension, findKey, moveFindMatch } from './FindExtension';

describe('find in the open note', () => {
  it('counts across formatting, highlights, moves, wraps, and updates after typing without changing content', () => {
    const editor = new Editor({
      extensions: [StarterKit, FindExtension],
      content: '<p>Café ca<strong>fé</strong> café தமிழ் தமிழ்</p>',
    });
    const before = editor.getHTML();
    editor.view.dispatch(editor.state.tr.setMeta(findKey, { query: 'cafe', selected: 0 }));
    expect(findKey.getState(editor.state)?.matches).toHaveLength(3);
    expect(editor.view.dom.querySelectorAll('.find-current')).toHaveLength(1);
    expect(editor.getHTML()).toBe(before);
    let selected = moveFindMatch(0, 1, 3);
    expect(selected).toBe(1);
    selected = moveFindMatch(selected, -1, 3);
    expect(selected).toBe(0);
    expect(moveFindMatch(0, -1, 3)).toBe(2);
    expect(moveFindMatch(2, 1, 3)).toBe(0);
    expect(moveFindMatch(0, 1, 0)).toBe(0);
    editor.view.dispatch(editor.state.tr.setMeta(findKey, { query: 'தமிழ்' }));
    expect(findKey.getState(editor.state)?.matches).toHaveLength(2);
    editor.commands.insertContentAt(1, 'தமிழ் ');
    expect(findKey.getState(editor.state)?.matches).toHaveLength(3);
    editor.view.dispatch(editor.state.tr.setMeta(findKey, { query: '' }));
    expect(editor.view.dom.querySelectorAll('.find-match')).toHaveLength(0);
    editor.destroy();
  });
});
