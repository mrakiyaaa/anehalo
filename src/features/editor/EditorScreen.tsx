import { useOpenNote } from '@/features/editor/use-open-note';
import { EditorHeader } from '@/features/editor/EditorHeader';
import { EditorNotice } from '@/features/editor/EditorNotice';
import { lazy, Suspense } from 'react';
import { StorageStatus } from '@/features/storage/StorageStatus';
import { SettingsNotice } from '@/features/settings/SettingsNotice';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/Icon';
import { useWorkspaceStore } from '@/store/use-workspace-store';

const MarkdownEditor = lazy(async () => {
  const module = await import('@/features/editor/MarkdownEditor');
  return { default: module.MarkdownEditor };
});

export function EditorScreen() {
  const { draft, isOpening, error } = useOpenNote();
  const goHome = useWorkspaceStore((state) => state.goHome);
  if (isOpening || !draft)
    return (
      <main className="editor-panel editor-loading" aria-label="Note editor">
        {isOpening ? (
          <p role="status">Opening note...</p>
        ) : (
          <>
            <p role="alert">
              {error?.code === 'not-found'
                ? 'This note was deleted or renamed outside Anehalo.'
                : (error?.message ?? 'This note could not be opened.')}
            </p>
            <Button
              variant="outline"
              onClick={() => {
                void goHome();
              }}
            >
              <Icon name="left" />
              Back to home
            </Button>
          </>
        )}
      </main>
    );
  return (
    <main className="editor-panel" aria-label="Note editor">
      <div className="editor-reading-width">
        <StorageStatus />
        <SettingsNotice />
        <EditorHeader draft={draft} />
        <EditorNotice draft={draft} />
        <Suspense fallback={<p className="editor-loading-body">Opening editor...</p>}>
          <MarkdownEditor key={`${draft.identifier}:${draft.documentVersion}`} draft={draft} />
        </Suspense>
      </div>
    </main>
  );
}
