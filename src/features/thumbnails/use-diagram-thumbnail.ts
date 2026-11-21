import { useEffect, useState } from 'react';
import { useWorkspaceStore } from '@/store/use-workspace-store';
import type { DiagramSummary } from '@/types/notes';
import type { ThumbnailSize } from './thumbnail-renderer';

export type ThumbnailView =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly url: string }
  | { readonly status: 'empty' }
  | { readonly status: 'corrupt' }
  | { readonly status: 'error' };

/**
 * A diagram's thumbnail, requested only while `visible`. It is fetched again when the file
 * changes (its time) or when it was redrawn after a save.
 */
export function useDiagramThumbnail(
  diagram: Pick<DiagramSummary, 'relativePath' | 'modifiedAt'>,
  visible: boolean,
  size: ThumbnailSize = 'card',
): ThumbnailView {
  const thumbnails = useWorkspaceStore((state) => state.thumbnails);
  const [view, setView] = useState<ThumbnailView>({ status: 'loading' });
  const { relativePath, modifiedAt } = diagram;

  useEffect(() => {
    if (!visible || !thumbnails) return;
    let cancelled = false;
    let url: string | null = null;
    const load = () => {
      void thumbnails.thumbnail(relativePath, size).then((thumbnail) => {
        if (cancelled) return;
        if (url) URL.revokeObjectURL(url);
        url = null;
        if (!thumbnail) setView({ status: 'error' });
        else if (thumbnail.state !== 'image') setView({ status: thumbnail.state });
        else {
          url = URL.createObjectURL(
            new Blob([thumbnail.bytes.slice()], { type: thumbnail.mimeType }),
          );
          setView({ status: 'ready', url });
        }
      });
    };
    load();
    const unsubscribe = thumbnails.subscribe((path) => {
      if (path === relativePath) load();
    });
    return () => {
      cancelled = true;
      unsubscribe();
      if (url) URL.revokeObjectURL(url);
    };
  }, [thumbnails, visible, relativePath, modifiedAt, size]);

  return view;
}
