import { Editor } from '@tiptap/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { editorExtensions } from '@/features/editor/editor-extensions';
import { MarkdownDocument } from '@/features/editor/MarkdownDocument';
import { NoteAutoSaver } from '@/features/editor/NoteAutoSaver';
import { InMemoryNoteRepository } from '@/features/storage/InMemoryNoteRepository';
import { unwrapResult } from '@/test/repository-helpers';
import { updateEditorLinks } from './update-editor-links';

const editors: Editor[] = [];
function editorFor(content: string) {
  const editor = new Editor({ extensions: editorExtensions(), content, contentType: 'markdown' });
  editors.push(editor);
  return editor;
}
afterEach(() => editors.splice(0).forEach((editor) => editor.destroy()));
describe('note link extension', () => {
  it.each([
    '[My note](Work/My%20note.md)',
    '[Tea & cake](Ideas/Tea%20%26%20cake%20%231%20%28draft%29.md)',
    '[日本語](日本語/100%25%20ready.md)',
    '[Custom **label**](Note.md)',
  ])('parses and serializes %s', (source) => {
    const editor = editorFor(source);
    expect(editor.getJSON().content?.[0]?.content?.[0]?.type).toBe('noteLink');
    const serialized = editor.getMarkdown();
    expect(editorFor(serialized).getJSON()).toEqual(editor.getJSON());
  });
  it('preserves web links and safely ignores invalid note targets', () => {
    const editor = editorFor('[web](https://example.com/Note.md) [bad](../Secret.md)');
    expect(editor.getHTML()).toContain('href="https://example.com/Note.md"');
    expect(editor.getHTML()).not.toContain('href="../Secret.md"');
    expect(editor.getHTML()).not.toContain('data-note-link');
  });
  it('keeps untouched source bytes identical and skips the save', async () => {
    const source = '  [My note](<Work/My%20note.md> "title")\r\n\r\n<u>Underlined</u>\r\n';
    const editor = editorFor(source);
    const document = new MarkdownDocument(source, editor);
    const repository = new InMemoryNoteRepository([
      { relativePath: 'Source.md', type: 'file', content: source },
    ]);
    const saver = new NoteAutoSaver(repository);
    const draft = unwrapResult(await saver.load('Source.md'));
    const write = vi.spyOn(repository, 'writeNote');
    saver.update(draft.identifier, { content: document.serialize(editor) });
    unwrapResult(await saver.flush(draft.identifier));
    expect(write).not.toHaveBeenCalled();
    expect(document.serialize(editor)).toBe(source);
    saver.pause();
  });
  it('updates node attributes without moving the cursor or emitting a user edit', () => {
    const editor = editorFor('Before [Old](Old.md) after');
    editor.commands.setTextSelection(12);
    const cursor: unknown = editor.state.selection.toJSON();
    const update = vi.fn();
    editor.on('update', update);
    updateEditorLinks(editor, [{ previousPath: 'Old.md', nextPath: 'New.md' }]);
    expect(editor.getMarkdown()).toBe('Before [New](New.md) after');
    expect(editor.state.selection.toJSON()).toEqual(cursor);
    expect(update).not.toHaveBeenCalled();
  });
});
