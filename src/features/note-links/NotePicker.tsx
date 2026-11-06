import { useEffect, useId, useState } from 'react';
import { FilePlus2, FileText } from 'lucide-react';
import type { NoteSummary } from '@/types/notes';
import { filterNotes } from './filter-notes';
import { folderTone } from '@/lib/folder-tone';
import { pathName } from '@/features/storage/storage-paths';
import { formatRelativeTime } from '@/lib/relative-time';
import { nextCommandIndex } from '@/features/editor/commands/slash-commands';

interface NotePickerProps {
  notes: readonly NoteSummary[];
  query: string;
  onChoose: (note: NoteSummary) => void;
  onCreate: (title: string) => void;
  onDismiss: () => void;
  keyboardTarget?: HTMLElement;
  onQueryChange?: (query: string) => void;
  busy?: boolean;
}
export function NotePicker({
  notes,
  query,
  onChoose,
  onCreate,
  onDismiss,
  keyboardTarget,
  onQueryChange,
  busy = false,
}: NotePickerProps) {
  const identifier = useId();
  const [currentTime] = useState(Date.now);
  const matches = filterNotes(notes, query);
  const canCreate = matches.length === 0 && query.trim().length > 0;
  const count = matches.length || (canCreate ? 1 : 0);
  const [selection, setSelection] = useState({ query, index: 0 });
  const selectedIndex =
    selection.query === query ? Math.min(selection.index, Math.max(0, count - 1)) : 0;
  const choose = (index: number) => {
    if (busy) return;
    const note = matches[index];
    if (note) onChoose(note);
    else if (canCreate) onCreate(query.trim());
  };
  const handleKey = (event: KeyboardEvent) => {
    if (event.isComposing || !['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(event.key))
      return;
    event.preventDefault();
    event.stopPropagation();
    if (event.key === 'Escape') onDismiss();
    else if (event.key === 'Enter') choose(selectedIndex);
    else setSelection({ query, index: nextCommandIndex(selectedIndex, event.key, count) });
  };
  useEffect(() => {
    if (!keyboardTarget) return;
    keyboardTarget.addEventListener('keydown', handleKey, true);
    return () => keyboardTarget.removeEventListener('keydown', handleKey, true);
  });
  useEffect(() => {
    if (!keyboardTarget || !count) return;
    const previousControls = keyboardTarget.getAttribute('aria-controls');
    const previousActive = keyboardTarget.getAttribute('aria-activedescendant');
    keyboardTarget.setAttribute('aria-controls', identifier);
    keyboardTarget.setAttribute('aria-activedescendant', `${identifier}-${selectedIndex}`);
    return () => {
      if (previousControls) keyboardTarget.setAttribute('aria-controls', previousControls);
      else keyboardTarget.removeAttribute('aria-controls');
      if (previousActive) keyboardTarget.setAttribute('aria-activedescendant', previousActive);
      else keyboardTarget.removeAttribute('aria-activedescendant');
    };
  }, [keyboardTarget, identifier, selectedIndex, count]);
  useEffect(() => {
    document.getElementById(`${identifier}-${selectedIndex}`)?.scrollIntoView({ block: 'nearest' });
  }, [identifier, selectedIndex]);
  return (
    <div
      className="note-picker"
      onKeyDown={(event) => {
        if (!keyboardTarget) handleKey(event.nativeEvent);
      }}
    >
      <p className="editor-popover-label">
        Link a note <span>↑ ↓ to navigate · Esc to close</span>
      </p>
      {onQueryChange && (
        <input
          aria-label="Find a note"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          autoFocus
          aria-controls={identifier}
          aria-activedescendant={count ? `${identifier}-${selectedIndex}` : undefined}
        />
      )}
      <div
        id={identifier}
        role="listbox"
        aria-label="Notes"
        aria-busy={busy}
        className="note-picker-list"
      >
        {matches.map((note, index) => (
          <button
            type="button"
            role="option"
            id={`${identifier}-${index}`}
            key={note.relativePath}
            aria-selected={index === selectedIndex}
            disabled={busy}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => choose(index)}
          >
            <FileText aria-hidden="true" size={16} />
            <span className="note-picker-copy">
              <strong>{note.title}</strong>
              <span>
                <span className={`note-picker-folder tone-${folderTone(note.folder)}`}>
                  {note.folder ? pathName(note.folder) : 'Vault root'}
                </span>
                <span>{formatRelativeTime(note.modifiedAt, currentTime)}</span>
              </span>
            </span>
          </button>
        ))}
        {canCreate && (
          <button
            type="button"
            role="option"
            id={`${identifier}-0`}
            aria-selected="true"
            disabled={busy}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => choose(0)}
          >
            <FilePlus2 size={16} aria-hidden="true" />
            <span>Create “{query.trim()}”</span>
          </button>
        )}
        {!count && (
          <p className="note-picker-empty">Type a title to create your first linked note.</p>
        )}
      </div>
    </div>
  );
}
