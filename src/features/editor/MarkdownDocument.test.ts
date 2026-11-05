import { Editor } from '@tiptap/core';
import { describe, expect, it, vi } from 'vitest';
import { MarkdownDocument } from '@/features/editor/MarkdownDocument';
import { editorExtensions } from '@/features/editor/editor-extensions';
import { NoteAutoSaver } from '@/features/editor/NoteAutoSaver';
import { InMemoryNoteRepository } from '@/features/storage/InMemoryNoteRepository';
import { unwrapResult } from '@/test/repository-helpers';

const sampleNotes = [
  '',
  'A plain paragraph.\n',
  '# Heading\r\n\r\nA **bold** and _italic_ thought.\r\n',
  '## Lists\n\n* First\n* Second\n\n1. One\n2. Two\n',
  '> A quote\n>\n> A second paragraph\n',
  '```typescript\nconst answer = 42;\n```\n\nUse `answer` here.\n',
  'A [useful link](https://example.com) and **strong _nested_ text**.\n\n',
  'Heading\n=======\n\nAn older Markdown spelling.\n',
];

describe('Markdown source preservation', () => {
  it.each(sampleNotes)('leaves an untouched sample byte-for-byte identical: %j', async (source) => {
    const editor = new Editor({
      extensions: editorExtensions(),
      content: source,
      contentType: 'markdown',
    });
    const document = new MarkdownDocument(source, editor);
    const repository = new InMemoryNoteRepository([
      { relativePath: 'Sample.md', type: 'file', content: source },
    ]);
    const write = vi.spyOn(repository, 'writeNote');
    const saver = new NoteAutoSaver(repository);
    try {
      const draft = unwrapResult(await saver.load('Sample.md'));
      saver.update(draft.identifier, { content: document.serialize(editor) });
      unwrapResult(await saver.flushAll());
      expect(write).not.toHaveBeenCalled();
      expect(unwrapResult(await repository.readNote('Sample.md')).content).toBe(source);
    } finally {
      saver.pause();
      editor.destroy();
    }
  });

  it('writes clean Markdown after an edit and restores the exact original after undo', () => {
    const source = '# A heading\r\n\r\nOriginal.\r\n';
    const editor = new Editor({
      extensions: editorExtensions(),
      content: source,
      contentType: 'markdown',
    });
    try {
      const document = new MarkdownDocument(source, editor);
      editor.commands.insertContent('New ');
      expect(document.serialize(editor)).toContain('New ');
      expect(document.serialize(editor)).not.toContain('<p>');
      editor.commands.undo();
      expect(document.serialize(editor)).toBe(source);
    } finally {
      editor.destroy();
    }
  });
});
