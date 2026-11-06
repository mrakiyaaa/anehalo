import { EditorContent, useEditor } from '@tiptap/react';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { useMemo, useState } from 'react';
import type { Editor } from '@tiptap/core';
import type { NoteDraft } from '@/features/editor/NoteDraft';
import { editorExtensions } from '@/features/editor/editor-extensions';
import { MarkdownDocument } from '@/features/editor/MarkdownDocument';
import { describeStorageError, success } from '@/features/storage/repository-result';
import { useWorkspaceStore } from '@/store/use-workspace-store';
import { useImageAttachments } from '@/features/attachments/use-image-attachments';
import { EditorTools } from './tools/EditorTools';
import { SlashMenu } from './tools/SlashMenu';
import { sanitizeEditorHtml } from './sanitize-editor-html';
import type { EditorActions } from './commands/editor-commands';
import { updateEditorLinks } from '@/features/note-links/update-editor-links';
import { useNoteExport } from '@/features/export/export-context';

export function MarkdownEditor({ draft }: { draft: NoteDraft }) {
  const updateContent = useWorkspaceStore((state) => state.updateNoteContent);
  const saveContent = useWorkspaceStore((state) => state.saveNoteContent);
  const reportContentError = useWorkspaceStore((state) => state.reportContentError);
  const isMutating = useWorkspaceStore((state) => state.isMutating || state.isClosing);
  const document = useRef<MarkdownDocument | null>(null);
  const editorReference = useRef<Editor | null>(null);
  const appliedRenames = useRef(draft.linkRenames.length);
  const { registerEditor } = useNoteExport();
  const {
    chooseImage,
    insertFiles,
    repository: attachmentRepository,
    fileInput,
    error: imageError,
    isAdding,
    clearError,
  } = useImageAttachments(draft.note.relativePath);
  const [openPopover, setOpenPopover] = useState<string | null>(null);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: editorExtensions({
      resolveImage: (reference) =>
        /^https?:\/\//i.test(reference)
          ? success(reference)
          : attachmentRepository.sourceUrl(draft.note.relativePath, reference),
    }),
    content: draft.content,
    contentType: 'markdown',
    autofocus: 'end',
    editorProps: {
      transformPastedHTML: sanitizeEditorHtml,
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []);
        if (files.length === 0) return false;
        event.preventDefault();
        if (editorReference.current) void insertFiles(editorReference.current, files);
        return true;
      },
      handleDrop: (view, event, _slice, moved) => {
        const files = Array.from(event.dataTransfer?.files ?? []);
        if (moved || files.length === 0) return false;
        event.preventDefault();
        const position = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        if (editorReference.current) void insertFiles(editorReference.current, files, position);
        return true;
      },
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
  const actions = useMemo<EditorActions>(
    () => ({
      link: () => setOpenPopover('toolbar:link'),
      color: () => setOpenPopover('toolbar:color'),
      size: () => setOpenPopover('toolbar:size'),
      page: () => setOpenPopover('toolbar:page'),
      image: () => {
        if (editor) void chooseImage(editor);
      },
    }),
    [editor, chooseImage],
  );
  useEffect(() => {
    if (!editor) return;
    const handleAction = ({ action }: { action: keyof EditorActions }) => actions[action]();
    editor.on('formattingAction', handleAction);
    return () => {
      editor.off('formattingAction', handleAction);
    };
  }, [editor, actions]);
  useLayoutEffect(() => {
    if (!editor) return;
    return registerEditor(draft.note.relativePath, () => editor.getMarkdown());
  }, [editor, draft.note.relativePath, registerEditor]);
  useLayoutEffect(() => {
    editorReference.current = editor;
    if (editor && !editor.isDestroyed)
      document.current ??= new MarkdownDocument(draft.content, editor);
  }, [editor, draft.content]);
  useLayoutEffect(() => {
    if (!editor || editor.isDestroyed || appliedRenames.current === draft.linkRenames.length)
      return;
    updateEditorLinks(editor, draft.linkRenames.slice(appliedRenames.current));
    appliedRenames.current = draft.linkRenames.length;
    document.current = new MarkdownDocument(draft.content, editor);
  }, [editor, draft.linkRenames, draft.content]);
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.setEditable(!isMutating, false);
    if (!isMutating && editor.isInitialized) editor.commands.focus();
  }, [editor, isMutating]);
  return (
    <>
      {editor && (
        <EditorTools
          editor={editor}
          disabled={isMutating}
          actions={actions}
          openPopover={openPopover}
          setOpenPopover={setOpenPopover}
        />
      )}
      {isAdding && (
        <p className="editor-image-status" role="status">
          Adding image...
        </p>
      )}
      {imageError && (
        <div className="editor-image-error" role="alert">
          <p>{imageError}</p>
          <button type="button" onClick={clearError}>
            Dismiss
          </button>
        </div>
      )}
      <input
        ref={fileInput}
        className="sr-only"
        tabIndex={-1}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        aria-label="Choose image"
        onChange={(event) => {
          if (editor) void insertFiles(editor, Array.from(event.target.files ?? []));
          event.target.value = '';
        }}
      />
      <EditorContent editor={editor} className="note-editor-body" />
      {editor && <SlashMenu editor={editor} actions={actions} />}
    </>
  );
}
