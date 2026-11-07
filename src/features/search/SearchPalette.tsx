import { useCurrentTime } from '@/lib/use-current-time';
import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useState } from 'react';
import { useWorkspaceStore } from '@/store/use-workspace-store';
import { folderTone } from '@/lib/folder-tone';
import { formatRelativeTime } from '@/lib/relative-time';
import type { SearchResult } from './SearchEngine';

export function HighlightedSnippet({ snippet }: { snippet: SearchResult['snippet'] }) {
  const parts = snippet.ranges.map((range, index) => {
    const prefix = snippet.text.slice(snippet.ranges[index - 1]?.end ?? 0, range.start);
    return (
      <span key={range.start}>
        {prefix}
        <mark>{snippet.text.slice(range.start, range.end)}</mark>
      </span>
    );
  });
  return (
    <>
      {parts}
      {snippet.text.slice(snippet.ranges.at(-1)?.end ?? 0)}
    </>
  );
}

function SearchResults({ close }: { close: () => void }) {
  const currentTime = useCurrentTime();
  const index = useWorkspaceStore((state) => state.searchIndex);
  const revision = useWorkspaceStore((state) => state.searchRevision);
  const openNote = useWorkspaceStore((state) => state.openNote);
  const query = useWorkspaceStore((state) => state.searchText);
  const setQuery = useWorkspaceStore((state) => state.setSearchText);
  const [results, setResults] = useState<readonly SearchResult[]>([]);
  const [selected, setSelected] = useState(0);
  const [searching, setSearching] = useState(true);
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      void index.search(query).then((found) => {
        if (!cancelled) {
          setResults(found);
          setSelected(0);
          setSearching(false);
        }
      });
    }, 20);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [index, query, revision]);
  useEffect(() => {
    document.getElementById(`search-result-${selected}`)?.scrollIntoView({ block: 'nearest' });
  }, [selected]);
  async function choose(result: SearchResult) {
    const opened = await openNote(result.note.relativePath);
    if (opened.ok) {
      close();
      requestAnimationFrame(() => document.querySelector<HTMLElement>('.note-prose')?.focus());
    }
  }
  return (
    <>
      <input
        autoFocus
        type="search"
        className="palette-input"
        placeholder="Search all your notes…"
        aria-label="Search all notes"
        role="combobox"
        aria-expanded="true"
        aria-controls="search-results"
        aria-autocomplete="list"
        aria-activedescendant={results[selected] ? `search-result-${selected}` : undefined}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setSearching(true);
        }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setSelected((current) =>
              results.length
                ? (current + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length
                : 0,
            );
          }
          if (event.key === 'Enter' && results[selected] && !searching) {
            event.preventDefault();
            void choose(results[selected]);
          }
        }}
      />
      <p className="palette-caption">
        {query.trim() ? 'Matching notes' : 'Recently edited'}
        <span>↑ ↓ to move · Enter to open · Esc to close</span>
      </p>
      <div
        id="search-results"
        role="listbox"
        aria-label="Notes"
        className="search-results"
        aria-busy={searching}
      >
        {!results.length && (
          <p className="palette-empty">
            {searching || index.isRefreshing ? 'Searching…' : 'No notes found. Try another word.'}
          </p>
        )}
        {results.map((result, position) => (
          <div
            key={result.note.relativePath}
            role="option"
            aria-selected={position === selected}
            id={`search-result-${position}`}
            className="search-result"
            onPointerMove={() => setSelected(position)}
            onClick={() => {
              void choose(result);
            }}
          >
            <div className="search-result-content">
              <span className="search-result-heading">
                <strong>{result.note.title}</strong>
                <time dateTime={new Date(result.note.modifiedAt).toISOString()}>
                  {formatRelativeTime(result.note.modifiedAt, currentTime.getTime())}
                </time>
              </span>
              <span className={`folder-chip tone-${folderTone(result.note.folder)}`}>
                {result.note.folder ?? 'Vault root'}
              </span>
              <span className="search-snippet">
                <HighlightedSnippet snippet={result.snippet} />
              </span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export function SearchPalette() {
  const open = useWorkspaceStore((state) => state.isSearchOpen);
  const setOpen = useWorkspaceStore((state) => state.setSearchOpen);
  const setQuery = useWorkspaceStore((state) => state.setSearchText);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.matches('[data-shortcut-recorder]'))
        return;
      if (
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === 'k'
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', keydown, true);
    return () => window.removeEventListener('keydown', keydown, true);
  }, [setOpen]);
  function close() {
    setOpen(false);
    setQuery('');
  }
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        if (!value) close();
        else setOpen(true);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="utility-overlay" />
        <Dialog.Content
          className="search-palette"
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            document.querySelector<HTMLElement>('.note-prose')?.focus();
          }}
        >
          <Dialog.Title className="sr-only">Search notes</Dialog.Title>
          <SearchResults close={close} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
