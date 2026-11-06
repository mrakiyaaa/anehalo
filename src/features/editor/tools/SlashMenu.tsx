import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@tiptap/core';
import {
  filterEditorCommands,
  nextCommandIndex,
  slashQuery,
  type SlashQuery,
} from '@/features/editor/commands/slash-commands';
import type { EditorActions, EditorCommand } from '@/features/editor/commands/editor-commands';
import { CommandList } from './CommandList';
import { PageNotePicker } from '@/features/note-links/PageNotePicker';

export function SlashMenu({ editor, actions }: { editor: Editor; actions: EditorActions }) {
  const [query, setQuery] = useState<SlashQuery | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const selected = useRef(0);
  const dismissed = useRef('');
  const lastQuery = useRef('');
  const commands = filterEditorCommands(query?.query ?? '').filter(
    (command) => command.enabled?.(editor) !== false,
  );

  const execute = useCallback(
    (command: EditorCommand, range: SlashQuery) => {
      editor.chain().focus().deleteRange({ from: range.from, to: range.to }).run();
      setQuery(null);
      command.run(editor, actions);
    },
    [editor, actions],
  );

  useEffect(() => {
    const update = () => {
      const next = editor.isEditable ? slashQuery(editor.state) : null;
      const identity = next ? `${next.from}:${next.query}` : '';
      if (identity !== lastQuery.current) {
        selected.current = 0;
        setSelectedIndex(0);
        lastQuery.current = identity;
      }
      if (!next || identity === dismissed.current) {
        setQuery(null);
        return;
      }
      const coordinates = editor.view.coordsAtPos(next.from);
      setPosition({
        left: Math.max(8, Math.min(coordinates.left, window.innerWidth - 380)),
        top: Math.max(8, Math.min(coordinates.bottom + 8, window.innerHeight - 340)),
      });
      setQuery(next);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (!editor.isEditable) return;
      const current = slashQuery(editor.state);
      if (current && /^page(?:\s|$)/i.test(current.query)) return;
      if (
        !current ||
        event.isComposing ||
        `${current.from}:${current.query}` === dismissed.current ||
        !['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(event.key)
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      if (event.key === 'Escape') {
        dismissed.current = `${current.from}:${current.query}`;
        setQuery(null);
        return;
      }
      const matching = filterEditorCommands(current.query).filter(
        (command) => command.enabled?.(editor) !== false,
      );
      if (event.key === 'Enter') {
        const command = matching[selected.current];
        if (command) execute(command, current);
      } else {
        selected.current = nextCommandIndex(selected.current, event.key, matching.length);
        setSelectedIndex(selected.current);
      }
    };
    editor.on('transaction', update);
    const editorElement = editor.view.dom;
    const hide = () => setQuery(null);
    editor.on('blur', hide);
    editor.on('focus', update);
    editorElement.addEventListener('keydown', handleKey, true);
    update();
    return () => {
      editor.off('transaction', update);
      editor.off('blur', hide);
      editor.off('focus', update);
      editorElement.removeEventListener('keydown', handleKey, true);
    };
  }, [editor, execute]);

  useEffect(() => {
    if (query)
      document
        .querySelector('#slash-commands [aria-selected="true"]')
        ?.scrollIntoView({ block: 'nearest' });
  }, [query, selectedIndex]);

  if (!query) return null;
  return createPortal(
    <div className="editor-popover slash-menu" style={position}>
      {/^page(?:\s|$)/i.test(query.query) ? (
        <PageNotePicker
          editor={editor}
          range={query}
          onDismiss={() => {
            dismissed.current = `${query.from}:${query.query}`;
            setQuery(null);
          }}
        />
      ) : (
        <>
          <p className="editor-popover-label">
            Insert or format <span>↑ ↓ to navigate · Esc to close</span>
          </p>
          <CommandList
            commands={commands}
            selectedIndex={selectedIndex}
            onSelect={(command) => execute(command, query)}
            listId="slash-commands"
          />
        </>
      )}
    </div>,
    document.body,
  );
}
