import { EditorContent, useEditor } from '@tiptap/react';
import { useEffect, useLayoutEffect, useRef } from 'react';
import type { NoteDraft } from '@/features/editor/NoteDraft';
import { editorExtensions } from '@/features/editor/editor-extensions';
import { MarkdownDocument } from '@/features/editor/MarkdownDocument';
import { describeStorageError } from '@/features/storage/repository-result';
import { useWorkspaceStore } from '@/store/use-workspace-store';

export function MarkdownEditor({ draft }: { draft: NoteDraft }) {
  const updateContent = useWorkspaceStore((state) => state.updateNoteContent);
  const saveContent = useWorkspaceStore((state) => state.saveNoteContent);
  const reportContentError = useWorkspaceStore((state) => state.reportContentError);
  const isMutating = useWorkspaceStore((state) => state.isMutating || state.isClosing);
  const document = useRef<MarkdownDocument | null>(null);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: editorExtensions(),
    content: draft.content,
    contentType: 'markdown',
    autofocus: 'end',
    editorProps: {
      attributes: {
        class: 'note-prose',
        role: 'textbox',
        'aria-label': 'Note content',
        'aria-multiline': 'true',
        spellcheck: 'true',
      },
    },
    onUpdate: ({ editor: updated }) => {
      try {
        if (!document.current) throw new Error('The editor document has not initialized.');
        updateContent(draft.identifier, document.current.serialize(updated));
      } catch (error) {
        reportContentError(
          draft.identifier,
          describeStorageError(
            error,
            'Could not prepare Markdown. Your text remains in the editor. Try editing again.',
          ),
        );
      }
    },
    onBlur: () => {
      void saveContent(draft.identifier);
    },
  });
  useLayoutEffect(() => {
    if (editor && !editor.isDestroyed)
      document.current ??= new MarkdownDocument(draft.content, editor);
  }, [editor, draft.content]);
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.setEditable(!isMutating, false);
    if (!isMutating && editor.isInitialized) editor.commands.focus('end');
  }, [editor, isMutating]);
  return <EditorContent editor={editor} className="note-editor-body" />;
}
