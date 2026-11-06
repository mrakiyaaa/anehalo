import type { Editor } from '@tiptap/core';
import { toggleQuote } from './toggle-quote';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Highlighter,
  Heading1,
  Heading2,
  Heading3,
  Pilcrow,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  CodeXml,
  Minus,
  Table,
  Image,
  Link,
  Undo2,
  Redo2,
  Rows3,
  Columns3,
  Trash2,
  Palette,
  Type,
  type LucideIcon,
} from 'lucide-react';

export interface EditorActions {
  link: () => void;
  image: () => void;
  color: () => void;
  size: () => void;
}
export interface EditorCommand {
  readonly id: string;
  readonly label: string;
  readonly group: 'text' | 'blocks' | 'insert' | 'history' | 'table';
  readonly icon: LucideIcon;
  readonly shortcut: string;
  readonly keywords?: string;
  readonly active?: (editor: Editor) => boolean;
  readonly enabled?: (editor: Editor) => boolean;
  readonly run: (editor: Editor, actions: EditorActions) => void;
}

const marks = [
  ['bold', 'Bold', Bold, 'Mod-b'],
  ['italic', 'Italic', Italic, 'Mod-i'],
  ['underline', 'Underline', Underline, 'Mod-u'],
  ['strike', 'Strikethrough', Strikethrough, 'Mod-Shift-s'],
  ['code', 'Inline code', Code, 'Mod-e'],
  ['highlight', 'Highlight', Highlighter, 'Mod-Shift-h'],
] as const;

export const editorCommands: readonly EditorCommand[] = [
  {
    id: 'paragraph',
    label: 'Paragraph',
    icon: Pilcrow,
    group: 'blocks',
    shortcut: 'Mod-Alt-0',
    active: (editor) => editor.isActive('paragraph'),
    run: (editor) => {
      editor.chain().focus().setParagraph().run();
    },
  },
  ...([1, 2, 3] as const).map((level): EditorCommand => ({
    id: `heading${level}`,
    label: `Heading ${level}`,
    icon: { 1: Heading1, 2: Heading2, 3: Heading3 }[level],
    group: 'blocks',
    shortcut: `Mod-Alt-${level}`,
    active: (editor) => editor.isActive('heading', { level }),
    run: (editor) => {
      editor.chain().focus().toggleHeading({ level }).run();
    },
  })),
  {
    id: 'bulletList',
    label: 'Bullet list',
    keywords: 'unordered',
    icon: List,
    group: 'blocks',
    shortcut: 'Mod-Shift-8',
    active: (editor) => editor.isActive('bulletList'),
    run: (editor) => {
      editor.chain().focus().toggleBulletList().run();
    },
  },
  {
    id: 'orderedList',
    label: 'Numbered list',
    keywords: 'ordered',
    icon: ListOrdered,
    group: 'blocks',
    shortcut: 'Mod-Shift-7',
    active: (editor) => editor.isActive('orderedList'),
    run: (editor) => {
      editor.chain().focus().toggleOrderedList().run();
    },
  },
  {
    id: 'taskList',
    label: 'Checklist',
    keywords: 'task todo',
    icon: ListTodo,
    group: 'blocks',
    shortcut: 'Mod-Shift-9',
    active: (editor) => editor.isActive('taskList'),
    run: (editor) => {
      editor.chain().focus().toggleTaskList().run();
    },
  },
  {
    id: 'blockquote',
    label: 'Quote',
    icon: Quote,
    group: 'blocks',
    shortcut: 'Mod-Shift-b',
    active: (editor) => editor.isActive('blockquote'),
    run: toggleQuote,
  },
  {
    id: 'codeBlock',
    label: 'Code block',
    icon: CodeXml,
    group: 'blocks',
    shortcut: 'Mod-Alt-c',
    active: (editor) => editor.isActive('codeBlock'),
    run: (editor) => {
      editor.chain().focus().toggleCodeBlock().run();
    },
  },
  ...marks.map(([id, label, icon, shortcut]): EditorCommand => ({
    id,
    label,
    icon,
    shortcut,
    group: 'text',
    active: (editor) => editor.isActive(id),
    run: (editor) => {
      editor.chain().focus().toggleMark(id).run();
    },
  })),
  {
    id: 'color',
    label: 'Text color',
    icon: Palette,
    group: 'text',
    shortcut: 'Mod-Shift-c',
    active: (editor) => editor.isActive('textColor'),
    run: (_editor, actions) => actions.color(),
  },
  {
    id: 'size',
    label: 'Text size',
    icon: Type,
    group: 'text',
    shortcut: 'Mod-Alt-s',
    active: (editor) => editor.isActive('textSize'),
    run: (_editor, actions) => actions.size(),
  },
  {
    id: 'link',
    label: 'Link',
    icon: Link,
    group: 'insert',
    shortcut: 'Mod-k',
    active: (editor) => editor.isActive('link'),
    run: (_editor, actions) => actions.link(),
  },
  {
    id: 'image',
    label: 'Image',
    icon: Image,
    group: 'insert',
    shortcut: 'Mod-Shift-m',
    run: (_editor, actions) => actions.image(),
  },
  {
    id: 'divider',
    label: 'Divider',
    icon: Minus,
    group: 'insert',
    shortcut: 'Mod-Alt-Enter',
    run: (editor) => {
      editor.chain().focus().setHorizontalRule().run();
    },
  },
  {
    id: 'table',
    label: 'Insert table',
    icon: Table,
    group: 'insert',
    shortcut: 'Mod-Alt-t',
    enabled: (editor) => !editor.isActive('table'),
    run: (editor) => {
      editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    },
  },
  {
    id: 'addRow',
    label: 'Add row',
    icon: Rows3,
    group: 'table',
    shortcut: 'Mod-Alt-ArrowDown',
    enabled: (editor) => editor.can().addRowAfter(),
    run: (editor) => {
      editor.chain().focus().addRowAfter().run();
    },
  },
  {
    id: 'deleteRow',
    label: 'Remove row',
    icon: Rows3,
    group: 'table',
    shortcut: 'Mod-Alt-Shift-ArrowDown',
    enabled: (editor) => editor.can().deleteRow(),
    run: (editor) => {
      editor.chain().focus().deleteRow().run();
    },
  },
  {
    id: 'addColumn',
    label: 'Add column',
    icon: Columns3,
    group: 'table',
    shortcut: 'Mod-Alt-ArrowRight',
    enabled: (editor) => editor.can().addColumnAfter(),
    run: (editor) => {
      editor.chain().focus().addColumnAfter().run();
    },
  },
  {
    id: 'deleteColumn',
    label: 'Remove column',
    icon: Columns3,
    group: 'table',
    shortcut: 'Mod-Alt-Shift-ArrowRight',
    enabled: (editor) => editor.can().deleteColumn(),
    run: (editor) => {
      editor.chain().focus().deleteColumn().run();
    },
  },
  {
    id: 'deleteTable',
    label: 'Delete table',
    icon: Trash2,
    group: 'table',
    shortcut: 'Mod-Alt-Backspace',
    enabled: (editor) => editor.can().deleteTable(),
    run: (editor) => {
      editor.chain().focus().deleteTable().run();
    },
  },
  {
    id: 'undo',
    label: 'Undo',
    icon: Undo2,
    group: 'history',
    shortcut: 'Mod-z',
    enabled: (editor) => editor.can().undo(),
    run: (editor) => {
      editor.chain().focus().undo().run();
    },
  },
  {
    id: 'redo',
    label: 'Redo',
    icon: Redo2,
    group: 'history',
    shortcut: 'Mod-y',
    enabled: (editor) => editor.can().redo(),
    run: (editor) => {
      editor.chain().focus().redo().run();
    },
  },
];

export function filterEditorCommands(query: string): readonly EditorCommand[] {
  const normalized = query.trim().toLowerCase();
  return editorCommands.filter((command) =>
    `${command.label} ${command.keywords ?? ''}`.toLowerCase().includes(normalized),
  );
}

export function shortcutLabel(shortcut: string): string {
  return shortcut
    .replace('Mod', 'Ctrl')
    .replaceAll('-', '+')
    .replace(/\+([a-z])$/, (_, character: string) => `+${character.toUpperCase()}`);
}
