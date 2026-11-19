import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '@/app/App';
import '@/features/editor/MarkdownEditor';
import { AppProviders } from '@/app/providers/AppProviders';
import { InMemoryNoteRepository } from '@/features/storage/InMemoryNoteRepository';
import {
  InMemorySettingsRepository,
  type MemorySettingsFile,
} from '@/features/settings/InMemorySettingsRepository';
import { defaultSettings } from '@/features/settings/AppSettings';
import { InMemoryFolderAccess } from '@/features/onboarding/InMemoryFolderAccess';
import { InMemoryAttachmentRepository } from '@/features/attachments/InMemoryAttachmentRepository';
import { InMemoryExportPlatform } from '@/features/export/InMemoryExportPlatform';

/** Opening a note saves it as the last opened note; holding that save keeps the open running. */
function holdSettingsWrites(file: MemorySettingsFile) {
  const write = file.write.bind(file);
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  file.write = async (content) => {
    await held;
    return write(content);
  };
  return () => release();
}

/** Records every editable change of the note editor, including ones reverted in the same frame. */
function recordEditableChanges() {
  const changes: string[] = [];
  const observer = new MutationObserver((records) => {
    for (const record of records)
      if (
        record.target instanceof HTMLElement &&
        record.target.getAttribute('aria-label') === 'Note content'
      )
        changes.push(`${record.oldValue} -> ${record.target.getAttribute('contenteditable')}`);
  });
  observer.observe(document.body, {
    subtree: true,
    attributes: true,
    attributeFilter: ['contenteditable'],
    attributeOldValue: true,
  });
  return {
    changes,
    stop: () => {
      observer.takeRecords();
      observer.disconnect();
    },
  };
}

async function renderWorkspace() {
  const settingsRepository = new InMemorySettingsRepository(
    JSON.stringify({ ...defaultSettings('Memory/Anehalo'), onboardingCompleted: true }),
  );
  render(
    <AppProviders
      services={{
        settingsRepository,
        folderAccess: new InMemoryFolderAccess(),
        createNoteRepository: () =>
          new InMemoryNoteRepository([
            { relativePath: 'Draft.md', type: 'file', content: 'Existing text' },
          ]),
        createAttachmentRepository: () => new InMemoryAttachmentRepository(),
        createExportPlatform: () => new InMemoryExportPlatform(),
      }}
    >
      <App />
    </AppProviders>,
  );
  await screen.findByRole('button', { name: 'Open Draft' });
  return settingsRepository;
}

describe('MarkdownEditor while a note is still opening', () => {
  let stopRecording: (() => void) | undefined;
  afterEach(() => stopRecording?.());

  it('is never editable before the opening operation finishes', async () => {
    const settingsRepository = await renderWorkspace();
    const user = userEvent.setup();
    const releaseSave = holdSettingsWrites(settingsRepository.file);
    const recording = recordEditableChanges();
    stopRecording = recording.stop;

    await user.click(screen.getByRole('button', { name: 'Open Draft' }));
    const content = await screen.findByRole('textbox', { name: 'Note content' });

    expect(content).toHaveAttribute('contenteditable', 'false');
    expect(recording.changes.filter((change) => change.startsWith('true'))).toEqual([]);

    releaseSave();
    await waitFor(() => expect(content).toHaveAttribute('contenteditable', 'true'));
  });

  it('marks the note editor busy until the opening operation finishes', async () => {
    const settingsRepository = await renderWorkspace();
    const user = userEvent.setup();
    const releaseSave = holdSettingsWrites(settingsRepository.file);

    await user.click(screen.getByRole('button', { name: 'Open Draft' }));
    await screen.findByRole('textbox', { name: 'Note content' });
    const region = screen.getByRole('main', { name: 'Note editor' });

    expect(region).toHaveAttribute('aria-busy', 'true');
    releaseSave();
    await waitFor(() => expect(region).toHaveAttribute('aria-busy', 'false'));
  });
});
