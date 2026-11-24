import { render } from '@testing-library/react';
import { vi } from 'vitest';
import type { ReactNode } from 'react';
import { AppServicesContext, type AppServices } from '@/app/app-services';
import { InMemoryAttachmentRepository } from '@/features/attachments/InMemoryAttachmentRepository';
import { ExportContext } from '@/features/export/export-context';
import { InMemoryExportPlatform } from '@/features/export/InMemoryExportPlatform';
import { InMemoryFolderAccess } from '@/features/onboarding/InMemoryFolderAccess';
import { InMemorySettingsRepository } from '@/features/settings/InMemorySettingsRepository';
import type { FileExplorer } from '@/features/storage/FileExplorer';
import { InMemoryNoteRepository } from '@/features/storage/InMemoryNoteRepository';
import type { MemoryEntry } from '@/features/storage/InMemoryVaultFileSystem';
import { success } from '@/features/storage/repository-result';
import { FakeGlobalShortcutService } from '@/features/shortcuts/FakeGlobalShortcutService';
import { FakeTrayService } from '@/features/tray/FakeTrayService';
import { WorkspaceContext } from '@/store/workspace-context';
import { createWorkspaceStore, type WorkspaceStore } from '@/store/workspace-store';
import { fakeDiagramCodec } from '@/test/diagram-helpers';

/** Records which vault paths were shown in File Explorer. */
export class FakeFileExplorer implements FileExplorer {
  readonly revealed: string[] = [];
  reveal(absolutePath: string) {
    this.revealed.push(absolutePath);
    return Promise.resolve(success(undefined));
  }
}

/**
 * A workspace over an in-memory vault whose diagrams use the stand-in codec, rendered with the
 * services that menus and headers read. Call `store.getState().pauseAutoSave()` after each test.
 */
export async function renderWorkspace(seed: readonly MemoryEntry[], ui: ReactNode) {
  const repository = new InMemoryNoteRepository(seed);
  const store: WorkspaceStore = createWorkspaceStore(repository, {
    diagramCodec: () => Promise.resolve(fakeDiagramCodec),
  });
  await store.getState().refreshTree();
  const fileExplorer = new FakeFileExplorer();
  const services: AppServices = {
    desktop: {
      shortcuts: new FakeGlobalShortcutService(),
      tray: new FakeTrayService(),
      fileExplorer,
    },
    settingsRepository: new InMemorySettingsRepository(),
    folderAccess: new InMemoryFolderAccess(),
    createNoteRepository: () => repository,
    createAttachmentRepository: () => new InMemoryAttachmentRepository(),
    createExportPlatform: () => new InMemoryExportPlatform(),
  };
  render(
    <AppServicesContext.Provider value={services}>
      <WorkspaceContext.Provider value={store}>
        <ExportContext.Provider
          value={{
            progress: null,
            run: vi.fn(),
            runDiagram: vi.fn(),
            registerEditor: vi.fn(() => () => undefined),
          }}
        >
          {ui}
        </ExportContext.Provider>
      </WorkspaceContext.Provider>
    </AppServicesContext.Provider>,
  );
  return { store, repository, files: repository.memoryFileSystem, fileExplorer };
}
