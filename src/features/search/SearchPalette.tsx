import { useCurrentTime } from '@/lib/use-current-time';
import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useState } from 'react';
import { useWorkspaceStore } from '@/store/use-workspace-store';
import { folderTone } from '@/lib/folder-tone';
import { formatRelativeTime } from '@/lib/relative-time';
import type { SearchFilter, SearchResult } from './SearchEngine';
import { Icon } from '@/components/ui/Icon';
import { FilterChips } from '@/features/notes/FilterChips';
import { isTypingInDiagramText } from '@/features/shortcuts/typing-target';
import { appShortcuts } from '@/features/shortcuts/app-shortcuts';

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
  const openSearchResult = useWorkspaceStore((state) => state.openSearchResult);
  const query = useWorkspaceStore((state) => state.searchText);
  const setQuery = useWorkspaceStore((state) => state.setSearchText);
  const [results, setResults] = useState<readonly SearchResult[]>([]);
  const [selected, setSelected] = useState(0);
  const [searching, setSearching] = useState(true);
  const [filter, setFilter] = useState<SearchFilter>('all');
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      void index.search(query, filter).then((found) => {
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
  }, [index, query, filter, revision]);
  useEffect(() => {
    document.getElementById(`search-result-${selected}`)?.scrollIntoView({ block: 'nearest' });
  }, [selected]);
  async function choose(result: SearchResult) {
    const { item } = result;
    const elementId =
      item.kind === 'diagram' ? index.matchedElement(item.relativePath, query) : null;
    const opened = await openSearchResult(item.relativePath, elementId);
    if (opened.ok) {
      close();
      if (item.kind === 'note')
        requestAnimationFrame(() => document.querySelector<HTMLElement>('.note-prose')?.focus());
    }
  }
  return (
    <>
      <input
        autoFocus
        type="search"
        className="palette-input"
        placeholder="Search notes and diagrams…"
        aria-label="Search notes and diagrams"
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
      <FilterChips
        value={filter}
        onChange={(next) => {
          setFilter(next);
          setSearching(true);
        }}
      />
      <p className="palette-caption">
        {query.trim() ? 'Matches' : 'Recently edited'}
        <span>↑ ↓ to move · Enter to open · Esc to close</span>
      </p>
      <div
        id="search-results"
        role="listbox"
        aria-label="Search results"
        className="search-results"
        aria-busy={searching}
      >
        {!results.length && (
          // A listbox must hold options, so the message is a disabled one.
          <p className="palette-empty" role="option" aria-disabled="true" aria-selected="false">
            {searching || index.isRefreshing ? 'Searching…' : 'Nothing found. Try another word.'}
          </p>
        )}
        {results.map((result, position) => (
          <div
            key={result.item.relativePath}
            data-kind={result.item.kind}
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
                <strong>
                  {result.item.kind === 'diagram' && (
                    <>
                      <Icon name="shapes" />
                      <span className="sr-only">Diagram: </span>
                    </>
                  )}
                  {result.item.title}
                </strong>
                <time dateTime={new Date(result.item.modifiedAt).toISOString()}>
                  {formatRelativeTime(result.item.modifiedAt, currentTime.getTime())}
                </time>
              </span>
              <span className={`folder-chip tone-${folderTone(result.item.folder)}`}>
                {result.item.folder ?? 'Vault root'}
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
      if (isTypingInDiagramText(event.target)) return;
      // Capturing first also keeps Excalidraw's own Ctrl+K (add link) from running on diagrams.
      if (appShortcuts.search.matches(event)) {
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
          <Dialog.Title className="sr-only">Search notes and diagrams</Dialog.Title>
          <SearchResults close={close} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
