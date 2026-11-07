import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { NoteSummary } from '@/types/notes';

interface VirtualNotesProps {
  readonly notes: readonly NoteSummary[];
  readonly layout: 'grid' | 'list';
  readonly renderNote: (note: NoteSummary) => ReactNode;
}

export function VirtualNotes(props: VirtualNotesProps) {
  return props.notes.length > 100 ? (
    <WindowedNotes {...props} />
  ) : (
    <>{props.notes.map(props.renderNote)}</>
  );
}

function WindowedNotes({ notes, layout, renderNote }: VirtualNotesProps) {
  'use no memo';
  const container = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ columns: layout === 'grid' ? 2 : 1, margin: 0 });
  useLayoutEffect(() => {
    const element = container.current;
    const scrollElement = element?.closest<HTMLElement>(
      layout === 'grid' ? '.home-panel' : '.app-sidebar',
    );
    if (!element || !scrollElement) return;
    const measure = () =>
      setDimensions({
        columns: layout === 'grid' ? Math.max(1, Math.floor((element.clientWidth + 14) / 244)) : 1,
        margin:
          element.getBoundingClientRect().top -
          scrollElement.getBoundingClientRect().top +
          scrollElement.scrollTop,
      });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    observer.observe(scrollElement);
    return () => observer.disconnect();
  }, [layout]);
  // eslint-disable-next-line react-hooks/incompatible-library -- Mutable layout measurements intentionally stay outside compiler memoization.
  const rows = useVirtualizer({
    count: Math.ceil(notes.length / dimensions.columns),
    getScrollElement: () =>
      container.current?.closest<HTMLElement>(layout === 'grid' ? '.home-panel' : '.app-sidebar') ??
      null,
    estimateSize: () => (layout === 'grid' ? 220 : 42),
    overscan: 3,
    scrollMargin: dimensions.margin,
    initialRect: { width: 900, height: 800 },
  });
  return (
    <div
      ref={container}
      className="virtual-notes"
      style={{ height: rows.getTotalSize(), gridColumn: '1 / -1' }}
    >
      {rows.getVirtualItems().map((row) => (
        <div
          key={row.key}
          data-index={row.index}
          ref={rows.measureElement}
          className="virtual-note-row"
          style={{
            transform: `translateY(${row.start - dimensions.margin}px)`,
            gridTemplateColumns: `repeat(${dimensions.columns}, minmax(0, 1fr))`,
            paddingBottom: layout === 'grid' ? 14 : 0,
          }}
        >
          {notes
            .slice(row.index * dimensions.columns, (row.index + 1) * dimensions.columns)
            .map(renderNote)}
        </div>
      ))}
    </div>
  );
}
