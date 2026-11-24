import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Saving a copy serializes with Excalidraw, which probes a 2D canvas when it loads.
vi.hoisted(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: () => ({}),
  });
});
// The real renderer loads Excalidraw and draws on a canvas, which jsdom cannot do.
vi.mock('@/features/thumbnails/thumbnail-renderer', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/thumbnails/thumbnail-renderer')>()),
  diagramImageRenderer: {
    png: () => Promise.resolve(new Blob([new Uint8Array([1, 2, 3])])),
    svg: () => Promise.resolve('<svg/>'),
  },
}));
import { AppServicesContext, type AppServices } from '@/app/app-services';
import {
  defaultDiagramExportOptions,
  type DiagramExportOptions,
} from '@/features/diagram-export/diagram-export-options';
import type { DiagramExportRequest } from '@/features/diagram-export/DiagramExportService';
import { InMemoryAttachmentRepository } from '@/features/attachments/InMemoryAttachmentRepository';
import { InMemoryFolderAccess } from '@/features/onboarding/InMemoryFolderAccess';
import { defaultSettings } from '@/features/settings/AppSettings';
import { InMemorySettingsRepository } from '@/features/settings/InMemorySettingsRepository';
import { SettingsContext } from '@/features/settings/settings-context';
import { createSettingsStore } from '@/features/settings/settings-store';
import { InMemoryNoteRepository } from '@/features/storage/InMemoryNoteRepository';
import { WorkspaceContext } from '@/store/workspace-context';
import { createWorkspaceStore, type WorkspaceStore } from '@/store/workspace-store';
import { diagramFile, fakeDiagramCodec } from '@/test/diagram-helpers';
import { unwrapResult } from '@/test/repository-helpers';
import { InMemoryExportPlatform } from './InMemoryExportPlatform';
import { ExportProvider } from './ExportProvider';
import { useNoteExport } from './export-context';

const stores: WorkspaceStore[] = [];
afterEach(() => stores.splice(0).forEach((store) => store.getState().pauseAutoSave()));

function Trigger({ request }: { request: DiagramExportRequest }) {
  const { runDiagram } = useNoteExport();
  return (
    <button
      type="button"
      onClick={() => {
        void runDiagram(request);
      }}
    >
      Run
    </button>
  );
}

async function setup(request: DiagramExportRequest, openDiagram = true) {
  const platform = new InMemoryExportPlatform();
  platform.destination = 'C:\\Share\\Flow.excalidraw';
  const settingsRepository = new InMemorySettingsRepository(
    JSON.stringify({ ...defaultSettings('Memory/Anehalo'), onboardingCompleted: true }),
  );
  const settings = createSettingsStore(settingsRepository);
  await settings.getState().load();
  const repository = new InMemoryNoteRepository([
    { relativePath: 'Flow.excalidraw', type: 'file', content: diagramFile('a') },
  ]);
  const workspace = createWorkspaceStore(repository, {
    diagramCodec: () => Promise.resolve(fakeDiagramCodec),
  });
  stores.push(workspace);
  await workspace.getState().refreshTree();
  if (openDiagram) unwrapResult(await workspace.getState().openItem('Flow.excalidraw'));
  const services: AppServices = {
    settingsRepository,
    folderAccess: new InMemoryFolderAccess(),
    createNoteRepository: () => repository,
    createAttachmentRepository: () => new InMemoryAttachmentRepository(),
    createExportPlatform: () => platform,
  };
  render(
    <AppServicesContext.Provider value={services}>
      <SettingsContext.Provider value={settings}>
        <WorkspaceContext.Provider value={workspace}>
          <ExportProvider repository={repository}>
            <Trigger request={request} />
          </ExportProvider>
        </WorkspaceContext.Provider>
      </SettingsContext.Provider>
    </AppServicesContext.Provider>,
  );
  return { platform, settings, settingsRepository, user: userEvent.setup() };
}

const chosen: DiagramExportOptions = {
  format: 'svg',
  background: false,
  theme: 'dark',
  scale: 3,
  embedScene: true,
};

describe('exporting the open diagram', () => {
  it('runs the request, shows its result, and remembers the options in settings.json', async () => {
    const { platform, settings, settingsRepository, user } = await setup({
      action: 'copy-png',
      options: chosen,
      selection: null,
    });
    await user.click(screen.getByRole('button', { name: 'Run' }));
    expect(await screen.findByText('Copied PNG to the clipboard')).toBeInTheDocument();
    expect(platform.clipboardImages).toHaveLength(1);
    await waitFor(() => expect(settings.getState().settings?.diagramExport).toEqual(chosen));
    expect(JSON.parse(settingsRepository.file.content ?? '{}')).toMatchObject({
      diagramExport: chosen,
    });
  });

  it('remembers the options even when the export fails', async () => {
    const { platform, settings, user } = await setup({
      action: 'copy-svg',
      options: chosen,
      selection: null,
    });
    platform.failClipboard = true;
    await user.click(screen.getByRole('button', { name: 'Run' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The clipboard is busy or unavailable. Try again.',
    );
    await waitFor(() => expect(settings.getState().settings?.diagramExport).toEqual(chosen));
  });

  it('keeps the remembered image options when saving a copy for sharing', async () => {
    const { platform, settings, user } = await setup({
      action: 'save-copy',
      options: chosen,
      selection: null,
    });
    await user.click(screen.getByRole('button', { name: 'Run' }));
    expect(await screen.findByText('Saved a copy of the diagram')).toBeInTheDocument();
    expect(platform.bundles[0]?.path).toBe('C:\\Share\\Flow.excalidraw');
    expect(settings.getState().settings?.diagramExport).toEqual(defaultDiagramExportOptions);
  });

  it('says so when no diagram is open', async () => {
    const { user } = await setup({ action: 'copy-png', options: chosen, selection: null }, false);
    await user.click(screen.getByRole('button', { name: 'Run' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Open a diagram to export it.');
  });
});
