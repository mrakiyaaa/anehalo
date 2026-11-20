import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import type { DiagramSummary } from '@/types/notes';
import { useDiagramThumbnail, type ThumbnailView } from './use-diagram-thumbnail';

/** True once the element has scrolled into view; thumbnails are only fetched for those. */
function useSeen<Element extends HTMLElement>() {
  const element = useRef<Element>(null);
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    const target = element.current;
    if (seen || !target) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [seen]);
  return { element, seen };
}

const placeholderText: Readonly<Record<Exclude<ThumbnailView['status'], 'ready'>, string>> = {
  loading: 'Drawing preview…',
  empty: 'Empty diagram',
  error: 'Preview unavailable',
};

export function DiagramThumbnail({ diagram }: { diagram: DiagramSummary }) {
  const { element, seen } = useSeen<HTMLDivElement>();
  const view = useDiagramThumbnail(diagram, seen);
  return (
    <div ref={element} className="diagram-thumbnail" data-state={view.status}>
      {view.status === 'ready' ? (
        <img src={view.url} alt={`Preview of ${diagram.title}`} draggable={false} />
      ) : (
        <div className="diagram-thumbnail-placeholder">
          <Icon name="shapes" />
          <span>{placeholderText[view.status]}</span>
        </div>
      )}
    </div>
  );
}
