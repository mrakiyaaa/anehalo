import { SearchPalette } from '@/features/search/SearchPalette';
import { SettingsScreen } from '@/features/settings/SettingsScreen';
import { DesktopNotice } from '@/features/tray/DesktopNotice';
import { UpdateBanner } from '@/features/updates/UpdateBanner';
import { MainArea } from '@/components/layout/MainArea';
import { Sidebar } from '@/components/layout/Sidebar';
import { StatusBar } from '@/components/layout/StatusBar';
import { TitleBar } from '@/components/layout/TitleBar';
import { useQuickCaptureShortcut } from '@/features/editor/use-quick-capture-shortcut';
import { useWorkspaceStore } from '@/store/use-workspace-store';
import { EditorScreen } from '@/features/editor/EditorScreen';
import { useLayoutEffect } from 'react';

export function AppShell() {
  const startQuickNote = useWorkspaceStore((state) => state.startQuickNote);
  const isMutating = useWorkspaceStore((state) => state.isMutating);
  const view = useWorkspaceStore((state) => state.view);
  const vaultReady = useWorkspaceStore((state) => Boolean(state.tree.vaultPath));
  useLayoutEffect(() => {
    if (vaultReady && performance.getEntriesByName('anehalo:usable').length === 0)
      performance.mark('anehalo:usable');
  }, [vaultReady]);
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
      <SearchPalette />
      <SettingsScreen />
      <UpdateBanner />
      <DesktopNotice />
    </div>
  );
}
