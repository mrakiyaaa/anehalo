import type { Editor } from '@tiptap/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { findKey, moveFindMatch } from './FindExtension';

export function FindBar({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [found, setFound] = useState(() => findKey.getState(editor.state));
  const input = useRef<HTMLInputElement>(null);
  const close = useCallback(() => {
    editor.view.dispatch(editor.state.tr.setMeta(findKey, { query: '' }));
    setQuery('');
    setOpen(false);
    editor.commands.focus();
  }, [editor]);
  useEffect(() => {
    const update = () => setFound(findKey.getState(editor.state));
    editor.on('transaction', update);
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && open && !document.querySelector('[role=dialog]')) {
        event.preventDefault();
        close();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        setOpen(true);
        requestAnimationFrame(() => {
          input.current?.focus();
          input.current?.select();
        });
      }
    };
    window.addEventListener('keydown', keydown);
    return () => {
      editor.off('transaction', update);
      window.removeEventListener('keydown', keydown);
    };
  }, [editor, open, close]);
  function move(direction: number) {
    const current = findKey.getState(editor.state);
    if (!current) return;
    const selected = moveFindMatch(current.selected, direction, current.matches.length);
    editor.view.dispatch(editor.state.tr.setMeta(findKey, { selected }));
    const match = current.matches[selected];
    if (match) {
      const element = editor.view.domAtPos(match.from).node.parentElement;
      element?.scrollIntoView({ block: 'center' });
    }
  }
  if (!open) return null;
  return (
    <div
      className="find-bar"
      role="search"
      aria-label="Find in note"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          close();
        }
        if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
          event.preventDefault();
          move(event.shiftKey ? -1 : 1);
        }
      }}
    >
      <input
        ref={input}
        type="search"
        aria-label="Find in note"
        placeholder="Find in this note"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          editor.view.dispatch(
            editor.state.tr.setMeta(findKey, { query: event.target.value, selected: 0 }),
          );
        }}
      />
      <output aria-live="polite">
        {found?.matches.length ? found.selected + 1 : 0} / {found?.matches.length ?? 0}
      </output>
      <button type="button" aria-label="Previous match" onClick={() => move(-1)}>
        ↑
      </button>
      <button type="button" aria-label="Next match" onClick={() => move(1)}>
        ↓
      </button>
      <button type="button" aria-label="Close find" onClick={close}>
        ×
      </button>
    </div>
  );
}
