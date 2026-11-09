import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '@/app/App';
import { AppProviders } from '@/app/providers/AppProviders';
import '@/features/editor/MarkdownEditor';
import { defaultSettings } from '@/features/settings/AppSettings';
import { InMemorySettingsRepository } from '@/features/settings/InMemorySettingsRepository';
import { InMemoryFolderAccess } from '@/features/onboarding/InMemoryFolderAccess';
import { InMemoryAttachmentRepository } from '@/features/attachments/InMemoryAttachmentRepository';
import { InMemoryExportPlatform } from '@/features/export/InMemoryExportPlatform';
import { FakeGlobalShortcutService } from '@/features/shortcuts/FakeGlobalShortcutService';
import { InMemoryNoteRepository } from '@/features/storage/InMemoryNoteRepository';
import { FakeTrayService } from '@/features/tray/FakeTrayService';
import { DesktopContext } from '@/features/tray/desktop-context';
import { unwrapResult } from '@/test/repository-helpers';
import { FakeUpdateService } from './FakeUpdateService';
import { UpdateSettings } from './UpdateSettings';
import { createUpdateRuntime } from './update-test-runtime';

const disposers: (() => void)[] = [];
afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
});

async function mount(settingsPatch: Partial<ReturnType<typeof defaultSettings>> = {}) {
  const context = await createUpdateRuntime();
  disposers.push(context.dispose);
  const change = vi.fn(() => Promise.resolve());
  render(
    <DesktopContext.Provider value={context.runtime}>
      <UpdateSettings
        settings={{ ...defaultSettings('Memory/Anehalo'), ...settingsPatch }}
        change={change}
      />
    </DesktopContext.Provider>,
  );
  await context.runtime.updates.start();
  return { ...context, change, user: userEvent.setup() };
}
const checkButton = () => screen.getByRole('button', { name: 'Check for updates' });

describe('the Updates section of Settings', () => {
  it('has the automatic check on by default and saves a change to it', async () => {
    const { change, user } = await mount();
    const toggle = screen.getByRole('checkbox', { name: 'Automatically check for updates' });
    expect(toggle).toBeChecked();
    await user.click(toggle);
    expect(change).toHaveBeenCalledWith({ autoCheckForUpdates: false });
  });

  it('shows the toggle as off when the setting is off', async () => {
    await mount({ autoCheckForUpdates: false });
    expect(
      screen.getByRole('checkbox', { name: 'Automatically check for updates' }),
    ).not.toBeChecked();
  });

  it("says You're up to date, with the version read from the app", async () => {
    const { user } = await mount();
    await user.click(checkButton());
    expect(await screen.findByText("You're up to date (0.1.1).")).toBeInTheDocument();
  });

  it('offers an available update and installs it from Settings', async () => {
    const { updater, user } = await mount();
    updater.offer = { version: '0.1.2' };
    await user.click(checkButton());
    expect(await screen.findByText('Anehalo 0.1.2 is available.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Update now' }));
    await waitFor(() => expect(updater.calls).toContain('install'));
  });

  it('reports a failed manual check, which the background check never does', async () => {
    const { updater, user } = await mount();
    updater.goOffline();
    await user.click(checkButton());
    expect(await screen.findByText(/Couldn't check for updates/)).toBeInTheDocument();
  });

  it('is disabled, with a reason, in a build where updates are off', async () => {
    const context = await createUpdateRuntime();
    disposers.push(context.dispose);
    context.updater.supported = false;
    render(
      <DesktopContext.Provider value={context.runtime}>
        <UpdateSettings settings={defaultSettings('Memory/Anehalo')} change={vi.fn()} />
      </DesktopContext.Provider>,
    );
    await context.runtime.updates.start();
    expect(await screen.findByText('Updates are turned off in development builds.')).toBeVisible();
    expect(checkButton()).toBeDisabled();
  });
});

describe('Settings in the whole app', () => {
  async function renderApp() {
    const repository = new InMemoryNoteRepository();
    unwrapResult(await repository.initializeVault());
    const settingsRepository = new InMemorySettingsRepository(
      JSON.stringify({ ...defaultSettings('Memory/Anehalo'), onboardingCompleted: true }),
    );
    const updater = new FakeUpdateService();
    // Not the version in package.json, so the test fails if the number is hard-coded.
    updater.version = '9.9.9';
    render(
      <AppProviders
        services={{
          settingsRepository,
          desktop: {
            tray: new FakeTrayService(),
            shortcuts: new FakeGlobalShortcutService(),
            updater,
          },
          folderAccess: new InMemoryFolderAccess(),
          createNoteRepository: () => repository,
          createAttachmentRepository: () => new InMemoryAttachmentRepository(),
          createExportPlatform: () => new InMemoryExportPlatform(),
        }}
      >
        <App />
      </AppProviders>,
    );
    await screen.findByRole('heading', { name: 'Welcome' });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    return {
      dialog: await screen.findByRole('dialog', { name: 'Settings' }),
      settingsRepository,
      user,
    };
  }

  it('shows the version of the running app, not a number baked into the build', async () => {
    const { dialog } = await renderApp();
    expect(await within(dialog).findByText('Version 9.9.9')).toBeInTheDocument();
  });

  it('saves the automatic-update toggle to settings.json and checks on request', async () => {
    const { dialog, settingsRepository, user } = await renderApp();
    await user.click(
      within(dialog).getByRole('checkbox', { name: 'Automatically check for updates' }),
    );
    await waitFor(async () =>
      expect(unwrapResult(await settingsRepository.load()).autoCheckForUpdates).toBe(false),
    );
    await user.click(within(dialog).getByRole('button', { name: 'Check for updates' }));
    expect(await within(dialog).findByText("You're up to date (9.9.9).")).toBeInTheDocument();
  });
});
