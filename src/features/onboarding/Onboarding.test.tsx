import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '@/app/App';
import { AppProviders } from '@/app/providers/AppProviders';
import { InMemorySettingsRepository } from '@/features/settings/InMemorySettingsRepository';
import { InMemoryNoteRepository } from '@/features/storage/InMemoryNoteRepository';
import { InMemoryFolderAccess } from '@/features/onboarding/InMemoryFolderAccess';
import { InMemoryAttachmentRepository } from '@/features/attachments/InMemoryAttachmentRepository';
import { useThemeStore } from '@/store/theme-store';
import { unwrapResult } from '@/test/repository-helpers';

function renderSetup(settingsRepository = new InMemorySettingsRepository()) {
  const vault = new InMemoryNoteRepository();
  const folderAccess = new InMemoryFolderAccess();
  const services = {
    settingsRepository,
    folderAccess,
    createNoteRepository: () => vault,
    createAttachmentRepository: () => new InMemoryAttachmentRepository(),
  };
  const view = render(
    <AppProviders services={services}>
      <App />
    </AppProviders>,
  );
  return { ...view, vault, folderAccess, settingsRepository };
}

describe('first launch onboarding', () => {
  beforeEach(() => {
    window.localStorage.clear();
    useThemeStore.getState().setPreference('system');
  });

  it('focuses each step, shows a live greeting, completes, and goes home on the next launch', async () => {
    const user = userEvent.setup();
    const setup = renderSetup();
    expect(await screen.findByRole('heading', { name: 'Meet Anehalo' })).toHaveFocus();
    expect(screen.getByText('Step 1 of 5')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Get started' }));
    expect(screen.getByRole('heading', { name: 'What should we call you?' })).toHaveFocus();
    await user.type(screen.getByRole('textbox', { name: /First name/ }), '  Akila  ');
    expect(screen.getByText(/Good (morning|afternoon|evening), Akila/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('heading', { name: 'Meet Anehalo' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Get started' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    setup.folderAccess.selection = 'D:/My notes';
    await user.click(screen.getByRole('button', { name: 'Browse…' }));
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: /Choose another folder/ })).toBeChecked(),
    );
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(screen.getByRole('radio', { name: 'Dark' }));
    await waitFor(() => expect(useThemeStore.getState().preference).toBe('dark'));
    expect(screen.getByRole('radio', { name: 'Dark' })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.queryByRole('button', { name: 'Skip setup' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start writing' }));
    expect(screen.getByRole('heading', { name: 'You are all set, Akila' })).toHaveFocus();
    expect(screen.getByText('D:/My notes')).toBeInTheDocument();
    expect(setup.settingsRepository.file.content).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Open Anehalo' }));
    await screen.findByRole('heading', { name: 'Welcome' });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /Good (morning|afternoon|evening), Akila/,
    );
    expect(unwrapResult(await setup.settingsRepository.load())).toMatchObject({
      userName: 'Akila',
      theme: 'dark',
      vaultPath: 'D:/My notes',
      onboardingCompleted: true,
    });
    setup.unmount();
    renderSetup(setup.settingsRepository);
    await screen.findByRole('heading', { name: /Good (morning|afternoon|evening), Akila/ });
    expect(screen.queryByRole('heading', { name: 'Meet Anehalo' })).not.toBeInTheDocument();
  });

  it('skip resets answers and the theme, then creates the default vault on confirmation', async () => {
    const user = userEvent.setup();
    const setup = renderSetup();
    await screen.findByRole('heading', { name: 'Meet Anehalo' });
    await user.click(screen.getByRole('button', { name: 'Get started' }));
    await user.type(screen.getByRole('textbox', { name: /First name/ }), 'Akila');
    useThemeStore.getState().setTheme('dark');
    await user.click(screen.getByRole('button', { name: 'Skip setup' }));
    expect(screen.getByRole('heading', { name: 'You are all set' })).toHaveFocus();
    expect(screen.getByText('No name')).toBeInTheDocument();
    expect(useThemeStore.getState().preference).toBeNull();
    expect(setup.settingsRepository.file.content).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Open Anehalo' }));
    await screen.findByRole('heading', { name: 'Welcome' });
    expect(unwrapResult(await setup.settingsRepository.load())).toMatchObject({
      userName: '',
      theme: 'system',
      vaultPath: 'Memory/Anehalo',
      onboardingCompleted: true,
    });
  });
});
