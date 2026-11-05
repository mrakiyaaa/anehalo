import { MainArea } from '@/components/layout/MainArea';
import { Sidebar } from '@/components/layout/Sidebar';
import { StatusBar } from '@/components/layout/StatusBar';
import { TitleBar } from '@/components/layout/TitleBar';
import { useQuickCaptureShortcut } from '@/features/editor/use-quick-capture-shortcut';
import { useWorkspaceStore } from '@/store/use-workspace-store';
import { EditorScreen } from '@/features/editor/EditorScreen';

export function AppShell() {
  const startQuickNote = useWorkspaceStore((state) => state.startQuickNote);
  const isMutating = useWorkspaceStore((state) => state.isMutating);
  const view = useWorkspaceStore((state) => state.view);
  async function createQuickNote() {
    if (isMutating) return;
    await startQuickNote();
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
      {view === 'editor' ? <EditorScreen /> : <MainArea />}
      <StatusBar />
    </div>
  );
}
