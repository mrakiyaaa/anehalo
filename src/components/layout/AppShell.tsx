import { SearchPalette } from '@/features/search/SearchPalette';
import { SettingsScreen } from '@/features/settings/SettingsScreen';
import { DesktopNotice } from '@/features/tray/DesktopNotice';
import { PreferenceNotice } from '@/features/settings/PreferenceNotice';
import { UpdateBanner } from '@/features/updates/UpdateBanner';
import { MainArea } from '@/components/layout/MainArea';
import { Sidebar } from '@/components/layout/Sidebar';
import { StatusBar } from '@/components/layout/StatusBar';
import { TitleBar } from '@/components/layout/TitleBar';
import { useInAppShortcut } from '@/features/shortcuts/use-in-app-shortcut';
import { useSettingsStore } from '@/features/settings/use-settings-store';
import { useWorkspaceStore } from '@/store/use-workspace-store';
import { EditorScreen } from '@/features/editor/EditorScreen';
import { DiagramScreen } from '@/features/diagrams/DiagramScreen';
import { useLayoutEffect } from 'react';
import { markStartupOnce, startupMarks } from '@/features/diagnostics/startup-marks';

export function AppShell() {
  const startQuickNote = useWorkspaceStore((state) => state.startQuickNote);
  const newDiagram = useWorkspaceStore((state) => state.newDiagram);
  const isMutating = useWorkspaceStore((state) => state.isMutating);
  const view = useWorkspaceStore((state) => state.view);
  const vaultReady = useWorkspaceStore((state) => Boolean(state.tree.vaultPath));
  const quickNoteShortcut = useSettingsStore((state) => state.settings?.quickNoteShortcut);
  const newDiagramShortcut = useSettingsStore((state) => state.settings?.newDiagramShortcut);
  useLayoutEffect(() => {
    if (vaultReady) markStartupOnce(startupMarks.usable);
  }, [vaultReady]);
  async function createQuickNote() {
    if (isMutating) return;
    await startQuickNote();
  }
  async function createDiagram() {
    if (isMutating) return;
    await newDiagram();
  }
  useInAppShortcut(quickNoteShortcut, createQuickNote);
  useInAppShortcut(newDiagramShortcut, createDiagram);

  return (
    <div className="app-shell">
      <TitleBar />
      <Sidebar
        onQuickNote={() => {
          void createQuickNote();
        }}
        onNewDiagram={() => {
          void createDiagram();
        }}
      />
      {view === 'editor' ? <EditorScreen /> : view === 'diagram' ? <DiagramScreen /> : <MainArea />}
      <StatusBar />
      <SearchPalette />
      <SettingsScreen />
      <UpdateBanner />
      <DesktopNotice />
      <PreferenceNotice />
    </div>
  );
}
