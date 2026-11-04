import { useRef } from 'react';
import { MainArea } from '@/components/layout/MainArea';
import { Sidebar } from '@/components/layout/Sidebar';
import { StatusBar } from '@/components/layout/StatusBar';
import { TitleBar } from '@/components/layout/TitleBar';
import { useQuickCaptureShortcut } from '@/features/editor/use-quick-capture-shortcut';
import { useWorkspaceStore } from '@/store/use-workspace-store';

export function AppShell() {
  const captureReference = useRef<HTMLTextAreaElement>(null);
  const startQuickNote = useWorkspaceStore((state) => state.startQuickNote);
  const isMutating = useWorkspaceStore((state) => state.isMutating);
  async function createQuickNote() {
    if (isMutating) return;
    const result = await startQuickNote();
    if (result.ok) captureReference.current?.focus();
  }
  useQuickCaptureShortcut(createQuickNote);

  return (
    <div className="app-shell">
      <TitleBar />
      <Sidebar
        onQuickNote={() => {
          void createQuickNote();
        }}
      />
      <MainArea captureReference={captureReference} />
      <StatusBar />
    </div>
  );
}
