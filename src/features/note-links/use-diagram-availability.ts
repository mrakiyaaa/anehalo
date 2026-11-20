import { useEffect, useState } from 'react';
import { useWorkspaceStore } from '@/store/use-workspace-store';
import type { DiagramSummary } from '@/types/notes';

export type DiagramAvailability =
  | { readonly state: 'present'; readonly diagram: DiagramSummary }
  | { readonly state: 'checking' }
  | { readonly state: 'missing' }
  | { readonly state: 'trash' };

/**
 * Whether a linked or embedded diagram is in the vault, in the trash, or gone. The trash is only
 * looked at once the diagram is missing from the vault, and again when the vault changes.
 */
export function useDiagramAvailability(path: string): DiagramAvailability {
  const diagram = useWorkspaceStore((state) =>
    state.tree.diagrams.find((item) => item.relativePath === path),
  );
  const diagrams = useWorkspaceStore((state) => state.tree.diagrams);
  const isDiagramInTrash = useWorkspaceStore((state) => state.isDiagramInTrash);
  const [trashed, setTrashed] = useState<{ path: string; inTrash: boolean } | null>(null);

  useEffect(() => {
    // An empty path means the caller is not a diagram link; there is nothing to look for.
    if (diagram || !path) return;
    let cancelled = false;
    void isDiagramInTrash(path).then((result) => {
      if (!cancelled) setTrashed({ path, inTrash: result.ok && result.value });
    });
    return () => {
      cancelled = true;
    };
  }, [diagram, diagrams, isDiagramInTrash, path]);

  if (diagram) return { state: 'present', diagram };
  if (trashed?.path !== path) return { state: 'checking' };
  return { state: trashed.inTrash ? 'trash' : 'missing' };
}
