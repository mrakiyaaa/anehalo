import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from './App';
import { AppProviders } from './providers/AppProviders';
import { defaultSettings } from '@/features/settings/AppSettings';
import { InMemorySettingsRepository } from '@/features/settings/InMemorySettingsRepository';
import { flushPreferenceSaves } from '@/features/settings/preference-sync';
import { InMemoryNoteRepository } from '@/features/storage/InMemoryNoteRepository';
import { InMemoryAttachmentRepository } from '@/features/attachments/InMemoryAttachmentRepository';
import { InMemoryExportPlatform } from '@/features/export/InMemoryExportPlatform';
import { InMemoryFolderAccess } from '@/features/onboarding/InMemoryFolderAccess';
import { FakeGlobalShortcutService } from '@/features/shortcuts/FakeGlobalShortcutService';
import { FakeTrayService } from '@/features/tray/FakeTrayService';
import { useAccentStore } from '@/store/accent-store';
import { useSidebarStore } from '@/store/sidebar-store';
import { unwrapResult } from '@/test/repository-helpers';

async function setup() {
  const repository = new InMemoryNoteRepository();
  unwrapResult(await repository.initializeVault());
  unwrapResult(await repository.createFolder('Work'));
  const settingsRepository = new InMemorySettingsRepository(
    JSON.stringify({ ...defaultSettings('Memory/Anehalo'), onboardingCompleted: true }),
  );
  render(
    <AppProviders
      services={{
        settingsRepository,
        desktop: { tray: new FakeTrayService(), shortcuts: new FakeGlobalShortcutService() },
        folderAccess: new InMemoryFolderAccess(),
        createNoteRepository: () => repository,
        createAttachmentRepository: () => new InMemoryAttachmentRepository(),
        createExportPlatform: () => new InMemoryExportPlatform(),
      }}
    >
      <App />
    </AppProviders>,
  );
  await screen.findByRole('button', { name: 'Quick note' });
  return { user: userEvent.setup(), settingsRepository };
}

const sidebar = () => screen.getByRole('complementary', { name: 'Sidebar' });
const pressToggle = (target: Window | Element = window) =>
  fireEvent.keyDown(target, { key: '\\', code: 'Backslash', ctrlKey: true });

beforeEach(() => {
  useAccentStore.getState().setAccent('sky');
  useSidebarStore.getState().restore(false);
});

describe('accent colour', () => {
  it('picks a colour from the title bar popover and saves it in the background', async () => {
    const { user, settingsRepository } = await setup();
    await user.click(screen.getByRole('button', { name: 'Accent color' }));
    const popover = await screen.findByRole('dialog');
    await user.click(within(popover).getByRole('radio', { name: 'Accent color: Mint' }));

    expect(document.documentElement.dataset.accent).toBe('mint');
    await act(() => flushPreferenceSaves());
    expect(unwrapResult(await settingsRepository.load()).accent).toBe('mint');
  });

  it('offers the same swatches in Settings → Appearance', async () => {
    const { user } = await setup();
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const appearance = screen.getByRole('region', { name: 'Appearance' });
    await user.click(within(appearance).getByRole('radio', { name: 'Accent color: Rose' }));
    expect(useAccentStore.getState().accent).toBe('rose');
    expect(
      within(appearance).getByRole('radio', { name: 'Accent color: Rose, selected' }),
    ).toBeChecked();
  });
});

describe('collapsible sidebar', () => {
  it('collapses to an icon rail with tooltips and expands again', async () => {
    const { user, settingsRepository } = await setup();
    await user.click(within(sidebar()).getByRole('button', { name: 'Collapse sidebar' }));

    expect(sidebar()).toHaveAttribute('data-collapsed', 'true');
    expect(within(sidebar()).queryByRole('navigation', { name: 'Items' })).not.toBeInTheDocument();
    const rail = within(sidebar()).getByRole('navigation', { name: 'Sidebar shortcuts' });
    for (const name of ['Search notes', 'Quick note', 'New diagram'])
      expect(within(rail).getByRole('button', { name })).toBeVisible();
    expect(within(rail).getByRole('button', { name: /^All items, [0-9]+ items?$/ })).toBeVisible();
    await user.hover(within(rail).getByRole('button', { name: 'Work, 0 items' }));
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Work');
    expect(within(sidebar()).getByRole('button', { name: 'Settings' })).toBeVisible();

    await act(() => flushPreferenceSaves());
    expect(unwrapResult(await settingsRepository.load()).sidebarCollapsed).toBe(true);
    await user.click(within(sidebar()).getByRole('button', { name: 'Expand sidebar' }));
    expect(within(sidebar()).getByRole('navigation', { name: 'Items' })).toBeVisible();
  });

  it('toggles with Ctrl+\\, but not while typing diagram text or with a dialog open', async () => {
    const { user } = await setup();
    pressToggle();
    await waitFor(() => expect(sidebar()).toHaveAttribute('data-collapsed', 'true'));
    pressToggle();
    await waitFor(() => expect(sidebar()).toHaveAttribute('data-collapsed', 'false'));

    const diagramText = document.createElement('textarea');
    diagramText.className = 'excalidraw-wysiwyg';
    document.body.append(diagramText);
    pressToggle(diagramText);
    diagramText.remove();
    expect(sidebar()).toHaveAttribute('data-collapsed', 'false');

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    pressToggle();
    // The open dialog hides the rest of the page from the accessibility tree.
    expect(useSidebarStore.getState().collapsedPreference).toBe(false);
  });
});
