import { defaultSettings } from '@/features/settings/AppSettings';
import { InMemorySettingsRepository } from '@/features/settings/InMemorySettingsRepository';
import { createSettingsStore } from '@/features/settings/settings-store';
import { FakeGlobalShortcutService } from '@/features/shortcuts/FakeGlobalShortcutService';
import { InMemoryNoteRepository } from '@/features/storage/InMemoryNoteRepository';
import { DesktopRuntime } from '@/features/tray/DesktopRuntime';
import { FakeTrayService } from '@/features/tray/FakeTrayService';
import { createWorkspaceStore } from '@/store/workspace-store';
import { unwrapResult } from '@/test/repository-helpers';
import { FakeUpdateService } from './FakeUpdateService';

/** A real desktop runtime and workspace around in-memory storage and a scriptable updater. */
export async function createUpdateRuntime() {
  const repository = new InMemoryNoteRepository([
    { relativePath: 'Plan.md', type: 'file', content: 'Original text' },
  ]);
  unwrapResult(await repository.initializeVault());
  const workspace = createWorkspaceStore(repository);
  await workspace.getState().initialize();
  const settingsRepository = new InMemorySettingsRepository(
    JSON.stringify({ ...defaultSettings('Memory/Anehalo'), onboardingCompleted: true }),
  );
  const settings = createSettingsStore(settingsRepository);
  await settings.getState().load();
  const tray = new FakeTrayService();
  const updater = new FakeUpdateService();
  const runtime = new DesktopRuntime(
    workspace,
    settings,
    new FakeGlobalShortcutService(),
    tray,
    updater,
  );
  return {
    runtime,
    workspace,
    settings,
    repository,
    settingsRepository,
    tray,
    updater,
    dispose: () => {
      runtime.updates.stop();
      workspace.getState().pauseAutoSave();
    },
  };
}
