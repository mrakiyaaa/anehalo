import { Editor, type JSONContent } from '@tiptap/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { editorExtensions } from './editor-extensions';
import { editorCommands, type EditorActions } from './commands/editor-commands';
import { textColors, textSizes } from './formatting-options';
import { MarkdownDocument } from './MarkdownDocument';
import { NoteAutoSaver } from './NoteAutoSaver';
import { InMemoryNoteRepository } from '@/features/storage/InMemoryNoteRepository';
import { unwrapResult } from '@/test/repository-helpers';

const editors: Editor[] = [];
function createEditor(source = 'A useful thought') {
  const editor = new Editor({
    extensions: editorExtensions(),
    content: source,
    contentType: 'markdown',
  });
  editors.push(editor);
  return editor;
}
afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy());
});
const actions: EditorActions = { link: vi.fn(), image: vi.fn(), color: vi.fn(), size: vi.fn() };

describe('formatting commands', () => {
  it.each(['link', 'image', 'color', 'size'])(
    'routes the %s shortcut to its UI action',
    (identifier) => {
      const editor = createEditor();
      const requested: string[] = [];
      editor.on('formattingAction', ({ action }) => {
        requested.push(action);
      });
      const command = editorCommands.find((item) => item.id === identifier);
      expect(command).toBeDefined();
      editor.commands.keyboardShortcut(command!.shortcut);
      expect(requested).toEqual([identifier]);
    },
  );
  it.each(
    editorCommands.filter((command) => command.group === 'blocks' && command.id !== 'paragraph'),
  )('runs the $label keyboard shortcut', (command) => {
    const editor = createEditor();
    editor.commands.setTextSelection(2);
    editor.commands.keyboardShortcut(command.shortcut);
    expect(command.active?.(editor)).toBe(true);
  });
  it.each(
    editorCommands.filter(
      (command) => command.active && !['paragraph', 'color', 'size', 'link'].includes(command.id),
    ),
  )('toggles $label on and off', (command) => {
    const editor = createEditor();
    editor.commands.selectAll();
    command.run(editor, actions);
    expect(command.active?.(editor)).toBe(true);
    command.run(editor, actions);
    expect(command.active?.(editor)).toBe(false);
  });
  it('sets paragraph and supports undo and redo', () => {
    const editor = createEditor('# Heading');
    editor.commands.setTextSelection(2);
    editorCommands.find((command) => command.id === 'paragraph')?.run(editor, actions);
    expect(editor.isActive('paragraph')).toBe(true);
    editor.commands.undo();
    expect(editor.isActive('heading')).toBe(true);
    editor.commands.redo();
    expect(editor.isActive('paragraph')).toBe(true);
  });
  it('sets and removes each semantic color', () => {
    const editor = createEditor();
    editor.commands.selectAll();
    for (const color of textColors) {
      expect(editor.commands.setTextColor(color.name)).toBe(true);
      expect(editor.getAttributes('textColor').color).toBe(color.name);
      editor.commands.setTextColor(null);
      expect(editor.isActive('textColor')).toBe(false);
    }
  });
  it('sets each size and returns to normal', () => {
    const editor = createEditor();
    editor.commands.selectAll();
    for (const size of textSizes.filter((entry) => entry.name !== 'normal')) {
      editor.commands.setTextSize(size.name);
      expect(editor.getAttributes('textSize').size).toBe(size.name);
      editor.commands.setTextSize('normal');
      expect(editor.isActive('textSize')).toBe(false);
    }
  });
  it('adds, edits and removes links', () => {
    const editor = createEditor();
    editor.commands.selectAll();
    editor.commands.setLink({ href: 'https://example.com' });
    expect(editor.getAttributes('link').href).toBe('https://example.com');
    editor.commands.setLink({ href: 'https://example.com/updated' });
    expect(editor.getMarkdown()).toContain('https://example.com/updated');
    editor.commands.unsetLink();
    expect(editor.isActive('link')).toBe(false);
  });
  it('inserts and deletes dividers', () => {
    const editor = createEditor();
    editor.commands.setHorizontalRule();
    expect(editor.getJSON().content?.some((node) => node.type === 'horizontalRule')).toBe(true);
    editor.commands.undo();
    expect(editor.getJSON().content?.some((node) => node.type === 'horizontalRule')).toBe(false);
  });
  it('inserts a table, adds and removes rows and columns, then deletes it', () => {
    const editor = createEditor('');
    const run = (identifier: string) =>
      editorCommands.find((command) => command.id === identifier)?.run(editor, actions);
    const table = (): JSONContent | undefined =>
      editor.getJSON().content?.find((node) => node.type === 'table');
    run('table');
    expect(table()?.content).toHaveLength(3);
    expect(table()?.content?.[0]?.content).toHaveLength(3);
    run('addRow');
    expect(table()?.content).toHaveLength(4);
    run('deleteRow');
    expect(table()?.content).toHaveLength(3);
    run('addColumn');
    expect(table()?.content?.[0]?.content).toHaveLength(4);
    run('deleteColumn');
    expect(table()?.content?.[0]?.content).toHaveLength(3);
    run('deleteTable');
    expect(table()).toBeUndefined();
  });
  it('uses the requested shortcuts and semantic choice shortcuts', () => {
    const editor = createEditor();
    editor.commands.selectAll();
    for (const shortcut of ['Mod-b', 'Mod-i', 'Mod-u', 'Mod-Shift-s', 'Mod-e', 'Mod-Shift-h'])
      editor.commands.keyboardShortcut(shortcut);
    for (const mark of ['bold', 'italic', 'underline', 'strike', 'code', 'highlight']) {
      // Code excludes other marks, so exercise each shortcut independently.
      editor.commands.unsetAllMarks();
      const command = editorCommands.find((item) => item.id === mark);
      expect(command).toBeDefined();
      editor.commands.keyboardShortcut(command!.shortcut);
      expect(editor.isActive(mark)).toBe(true);
    }
    editor.commands.unsetAllMarks();
    editor.commands.keyboardShortcut('Mod-Alt-Shift-1');
    expect(editor.getAttributes('textColor').color).toBe('sky');
    editor.commands.keyboardShortcut('Mod-Shift-4');
    expect(editor.getAttributes('textSize').size).toBe('huge');
  });
});

const formattedSamples = [
  '<span data-color="sky">Use `<span>` and **text**</span>',
  '<mark>Use `</mark>` literally</mark>',
  '**bold** and *italic* and ~~strike~~ and `inline code`',
  '<u>Underlined **bold**</u> and <mark>highlighted *italic*</mark>',
  ...textColors.map((color) => `<span data-color="${color.name}">Colored **text**</span>`),
  ...textSizes.map((size) => `<span data-size="${size.name}">Sized text</span>`),
  '<span data-color="rose"><span data-size="huge"><u><mark>**Combined**</mark></u></span></span>',
  '# One\n\n## Two\n\n### Three\n\nParagraph',
  '- Bullet\n- Another\n\n1. First\n2. Second',
  '- [ ] To do\n- [x] Complete',
  '> A quote\n\n```typescript\nconst note = true;\n```\n\n---',
  '| Name | Value |\n| --- | --- |\n| **One** | <u>Two</u> |',
  '[A link](https://example.com)',
  '![A picture](../.attachments/1234.png)',
];

describe('rich Markdown round trips', () => {
  it.each(formattedSamples)('retains the document after serialize and reload: %s', (source) => {
    const editor = createEditor(source);
    const reloaded = createEditor(editor.getMarkdown());
    expect(reloaded.getJSON()).toEqual(editor.getJSON());
  });
  it.each(formattedSamples)(
    'does not write an untouched note, including HTML: %s',
    async (sample) => {
      const source = `${sample.replaceAll('\n', '\r\n')}\r\n\r\n`;
      const repository = new InMemoryNoteRepository([
        { relativePath: 'Sample.md', type: 'file', content: source },
      ]);
      const saver = new NoteAutoSaver(repository);
      const write = vi.spyOn(repository, 'writeNote');
      try {
        const draft = unwrapResult(await saver.load('Sample.md'));
        const editor = createEditor(source);
        const document = new MarkdownDocument(source, editor);
        saver.update(draft.identifier, { content: document.serialize(editor) });
        unwrapResult(await saver.flushAll());
        expect(write).not.toHaveBeenCalled();
        expect(unwrapResult(await repository.readNote('Sample.md')).content).toBe(source);
      } finally {
        saver.pause();
      }
    },
  );
  it('writes semantic HTML rather than raw colors or styles', () => {
    const editor = createEditor();
    editor.commands.selectAll();
    editor.commands.setTextColor('mint');
    editor.commands.setTextSize('large');
    editor.commands.toggleUnderline();
    editor.commands.toggleHighlight();
    const markdown = editor.getMarkdown();
    expect(markdown).toContain('data-color="mint"');
    expect(markdown).toContain('data-size="large"');
    expect(markdown).toContain('<u>');
    expect(markdown).toContain('<mark>');
    expect(markdown).not.toMatch(/style=|#[\da-f]{6}|==/);
  });
});
