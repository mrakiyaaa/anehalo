import { useEffect, useId, useState } from 'react';
import { FilePlus2, FileText } from 'lucide-react';
import type { DiagramSummary, NoteSummary } from '@/types/notes';
import { Icon } from '@/components/ui/Icon';
import { filterNotes } from './filter-notes';
import { folderTone } from '@/lib/folder-tone';
import { pathName } from '@/features/storage/storage-paths';
import { formatRelativeTime } from '@/lib/relative-time';
import { nextCommandIndex } from '@/features/editor/commands/slash-commands';

/** Notes have no kind field; diagrams are marked, so the picker can show their icon. */
export type PickerItem = NoteSummary | DiagramSummary;

function isDiagram(item: PickerItem): item is DiagramSummary {
  return 'kind' in item && item.kind === 'diagram';
}

interface NotePickerProps {
  notes: readonly PickerItem[];
  query: string;
  onChoose: (item: PickerItem) => void;
  onCreate: (title: string) => void;
  onDismiss: () => void;
  keyboardTarget?: HTMLElement;
  onQueryChange?: (query: string) => void;
  busy?: boolean;
  /** The heading, for pickers that do something other than link a note. */
  heading?: string;
  /**
   * A create row shown first whatever is typed ("New diagram"); without it, creating is offered
   * only when nothing matches the typed title.
   */
  alwaysCreate?: string;
}

type Row = { readonly kind: 'item'; readonly item: PickerItem } | { readonly kind: 'create' };

export function NotePicker({
  notes,
  query,
  onChoose,
  onCreate,
  onDismiss,
  keyboardTarget,
  onQueryChange,
  busy = false,
  heading = 'Link a note',
  alwaysCreate,
}: NotePickerProps) {
  const identifier = useId();
  const [currentTime] = useState(Date.now);
  const matches = filterNotes(notes, query);
  const canCreate = alwaysCreate !== undefined || (matches.length === 0 && query.trim().length > 0);
  const rows: Row[] = [
    ...(alwaysCreate !== undefined ? [{ kind: 'create' } as const] : []),
    ...matches.map((item) => ({ kind: 'item', item }) as const),
    ...(alwaysCreate === undefined && canCreate ? [{ kind: 'create' } as const] : []),
  ];
  const count = rows.length;
  const [selection, setSelection] = useState({ query, index: 0 });
  const selectedIndex =
    selection.query === query ? Math.min(selection.index, Math.max(0, count - 1)) : 0;
  const choose = (index: number) => {
    if (busy) return;
    const row = rows[index];
    if (row?.kind === 'item') onChoose(row.item);
    else if (row?.kind === 'create') onCreate(query.trim());
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
        {heading} <span>↑ ↓ to navigate · Esc to close</span>
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
        {rows.map((row, index) =>
          row.kind === 'item' ? (
            <button
              type="button"
              role="option"
              id={`${identifier}-${index}`}
              key={row.item.relativePath}
              aria-selected={index === selectedIndex}
              disabled={busy}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(index)}
            >
              {isDiagram(row.item) ? (
                <Icon name="shapes" />
              ) : (
                <FileText aria-hidden="true" size={16} />
              )}
              <span className="note-picker-copy">
                <strong>{row.item.title}</strong>
                <span>
                  <span className={`note-picker-folder tone-${folderTone(row.item.folder)}`}>
                    {row.item.folder ? pathName(row.item.folder) : 'Vault root'}
                  </span>
                  <span>{formatRelativeTime(row.item.modifiedAt, currentTime)}</span>
                </span>
              </span>
            </button>
          ) : (
            <button
              type="button"
              role="option"
              id={`${identifier}-${index}`}
              key="create"
              aria-selected={index === selectedIndex}
              disabled={busy}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(index)}
            >
              <FilePlus2 size={16} aria-hidden="true" />
              <span>{alwaysCreate ?? `Create “${query.trim()}”`}</span>
            </button>
          ),
        )}
        {!count && (
          <p className="note-picker-empty">Type a title to create your first linked note.</p>
        )}
      </div>
    </div>
  );
}
