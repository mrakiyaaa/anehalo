import { lazy, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/Icon';
import { useWorkspaceStore } from '@/store/use-workspace-store';

const DiagramCanvas = lazy(async () => {
  const module = await import('@/features/diagrams/DiagramCanvas');
  return { default: module.DiagramCanvas };
});

export function DiagramScreen() {
  const goHome = useWorkspaceStore((state) => state.goHome);
  return (
    <main className="diagram-panel" aria-label="Diagram">
      <div className="diagram-toolbar">
        <Button
          variant="ghost"
          onClick={() => {
            void goHome();
          }}
        >
          <Icon name="left" />
          Back to home
        </Button>
        <p className="diagram-preview-note">Preview: diagrams are not saved yet.</p>
      </div>
      <Suspense
        fallback={
          <p role="status" className="diagram-loading">
            Opening diagram…
          </p>
        }
      >
        <DiagramCanvas />
      </Suspense>
    </main>
  );
}
