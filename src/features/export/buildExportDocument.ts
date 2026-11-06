import { Editor, type JSONContent } from '@tiptap/core';
import { editorExtensions } from '@/features/editor/editor-extensions';
import type { ExportDocument, ExportSource } from './export-types';

export function withExportEditor<Value>(
  content: string | JSONContent,
  read: (editor: Editor) => Value,
): Value {
  const editor = new Editor({
    element: null,
    extensions: editorExtensions(),
    content,
    ...(typeof content === 'string' ? { contentType: 'markdown' as const } : {}),
    editable: false,
    injectCSS: false,
  });
  try {
    return read(editor);
  } finally {
    editor.destroy();
  }
}
export function buildExportDocument(source: ExportSource): ExportDocument {
  return {
    title: source.title,
    relativePath: source.relativePath,
    document: withExportEditor(source.content, (editor) => editor.getJSON()),
  };
}
