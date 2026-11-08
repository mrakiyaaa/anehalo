import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from '@/app/App';
import { AppProviders } from '@/app/providers/AppProviders';
import { defaultSettings } from '@/features/settings/AppSettings';
import { InMemorySettingsRepository } from '@/features/settings/InMemorySettingsRepository';
import { InMemoryFolderAccess } from '@/features/onboarding/InMemoryFolderAccess';
import { InMemoryAttachmentRepository } from '@/features/attachments/InMemoryAttachmentRepository';
import { InMemoryExportPlatform } from '@/features/export/InMemoryExportPlatform';
import { InMemoryNoteRepository } from './InMemoryNoteRepository';
import { failure, type RepositoryResult } from './repository-result';
import type { VaultTree } from '@/types/notes';
import { createWorkspaceStore } from '@/store/workspace-store';
import { defaultScanLimits } from './ScanLimits';
import { unwrapResult } from '@/test/repository-helpers';

async function setup(path: string, errorCode?: 'not-found' | 'permission-denied' | 'scan-limit') {
  const settingsRepository = new InMemorySettingsRepository(
    JSON.stringify({
      ...defaultSettings('Memory/Anehalo'),
      onboardingCompleted: true,
      vaultPath: path,
    }),
  );
  const source = new InMemoryNoteRepository(
    Array.from({ length: 201 }, (_, index) => ({
      relativePath: `Other ${index}.md`,
      type: 'file' as const,
    })),
  );
  const scan = errorCode
    ? vi.spyOn(source, 'listTree').mockResolvedValue(
        failure({
          code: errorCode,
          message:
            errorCode === 'scan-limit'
              ? 'This folder has too many items to be a notes folder'
              : 'This saved folder cannot be opened.',
        }),
      )
    : vi.spyOn(source, 'listTree');
  const restored = new InMemoryNoteRepository();
  unwrapResult(await restored.initializeVault());
  const folderAccess = new InMemoryFolderAccess();
  render(
    <AppProviders
      services={{
        settingsRepository,
        folderAccess,
        createNoteRepository: (vaultPath) => (vaultPath === path ? source : restored),
        createAttachmentRepository: () => new InMemoryAttachmentRepository(),
        createExportPlatform: () => new InMemoryExportPlatform(),
      }}
    >
      <App />
    </AppProviders>,
  );
  await screen.findByRole('heading', { name: "We couldn't open your notes folder" });
  return { scan, source, restored, folderAccess, settingsRepository, user: userEvent.setup() };
}

describe('vault startup recovery', () => {
  it('offers recovery for an empty saved path without resetting onboarding or reading files', async () => {
    const { scan, settingsRepository } = await setup('');
    expect(scan).not.toHaveBeenCalled();
    expect(unwrapResult(await settingsRepository.load()).onboardingCompleted).toBe(true);
  });
  it('does not scan an old custom parent with more than 200 entries and never retries it on focus', async () => {
    const { scan, user } = await setup('D:/Documents');
    expect(scan).not.toHaveBeenCalled();
    fireEvent.focus(window);
    await act(() => Promise.resolve());
    expect(scan).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Choose a folder again' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Use the default folder' }));
    await screen.findByRole('heading', { name: 'Welcome' });
  });

  it.each(['not-found', 'permission-denied', 'scan-limit'] as const)(
    'recovers from a saved folder with %s',
    async (errorCode) => {
      const { scan, user, settingsRepository } = await setup('D:/Old/Anehalo', errorCode);
      await user.click(screen.getByRole('button', { name: 'Use the default folder' }));
      await screen.findByRole('heading', { name: 'Welcome' });
      expect(unwrapResult(await settingsRepository.load()).vaultPath).toBe('Memory/Anehalo');
      expect(scan).toHaveBeenCalledOnce();
    },
  );

  it('shows and confirms the final custom vault before reopening', async () => {
    const { user, folderAccess, settingsRepository } = await setup('D:/Documents');
    folderAccess.selection = 'D:/Restored notes';
    await user.click(screen.getByRole('button', { name: 'Choose a folder again' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Use this folder' })).toBeEnabled(),
    );
    expect(
      screen
        .getAllByText(/Your notes will be saved in/)
        .some((element) => element.textContent?.includes('D:/Restored notes/Anehalo')),
    ).toBe(true);
    expect(unwrapResult(await settingsRepository.load()).vaultPath).toBe('D:/Documents');
    await user.click(screen.getByRole('button', { name: 'Use this folder' }));
    await screen.findByRole('heading', { name: 'Welcome' });
    expect(unwrapResult(await settingsRepository.load()).vaultPath).toBe(
      'D:/Restored notes/Anehalo',
    );
  });

  it('bounds a stalled repository and stops automatic retries', async () => {
    const repository = new InMemoryNoteRepository();
    const scan = vi
      .spyOn(repository, 'listTree')
      .mockImplementation(() => new Promise(() => undefined));
    const store = createWorkspaceStore(repository, {
      vaultPath: 'D:/Notes/Anehalo',
      scanLimits: { ...defaultScanLimits, maximumDurationMilliseconds: 10 },
    });
    await store.getState().initialize();
    expect(store.getState().vaultError?.code).toBe('scan-limit');
    expect(store.getState().isLoading).toBe(false);
    await store.getState().refreshTree();
    expect(scan).toHaveBeenCalledOnce();
    store.getState().pauseAutoSave();
  });

  it('recovers when background hydration fails its limits after metadata is visible', async () => {
    const repository = Object.assign(new InMemoryNoteRepository(), {
      hydrateTree: () =>
        Promise.resolve(
          failure({
            code: 'scan-limit',
            message: 'This folder has too many items to be a notes folder',
          }),
        ),
    });
    const store = createWorkspaceStore(repository);
    await store.getState().initialize();
    expect(store.getState().vaultError?.code).toBe('scan-limit');
    expect(store.getState().isLoading).toBe(false);
    expect(await store.getState().startQuickNote()).toMatchObject({
      ok: false,
      error: { code: 'scan-limit' },
    });
    store.getState().pauseAutoSave();
  });

  it('retains a newly edited draft if a background scan fails while the user is typing', async () => {
    let complete: (result: RepositoryResult<VaultTree>) => void = () => {
      throw new Error('Hydration was not started.');
    };
    const pending = new Promise<RepositoryResult<VaultTree>>((resolve) => {
      complete = resolve;
    });
    const repository = Object.assign(new InMemoryNoteRepository(), { hydrateTree: () => pending });
    const store = createWorkspaceStore(repository);
    const initializing = store.getState().initialize();
    await vi.waitFor(() => expect(store.getState().isLoading).toBe(false));
    unwrapResult(await store.getState().startQuickNote());
    const draft = store.getState().openDraft;
    if (!draft) throw new Error('The draft is missing.');
    store.getState().updateNoteContent(draft.identifier, 'Keep this unsaved text.');
    complete(
      failure({
        code: 'scan-limit',
        message: 'This folder has too many items to be a notes folder',
      }),
    );
    await initializing;
    expect(store.getState().vaultError).toBeNull();
    expect(store.getState().error?.code).toBe('scan-limit');
    expect(store.getState().openDraft?.content).toBe('Keep this unsaved text.');
    store.getState().pauseAutoSave();
  });
});
