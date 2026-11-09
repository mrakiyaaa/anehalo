import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test, expect } from './fixtures';
import { Editor } from './pages/editor';

test('clearing a title and typing a new one keeps the text, and Enter renames the file', async ({
  application,
}) => {
  await application.seedSettings({ lastOpenedNotePath: 'Untitled note 2.md' });
  await writeFile(join(application.vault, 'Untitled note.md'), 'First note.');
  await writeFile(join(application.vault, 'Untitled note 2.md'), 'Second note.');
  await application.start(['--open']);
  const editor = new Editor(application.page);
  await editor.ready('Untitled note 2');

  await editor.title.click();
  await editor.title.press('Control+a');
  await editor.title.press('Backspace');
  // Longer than the auto-save delay that used to put "Untitled note 2" back into the field.
  await application.page.waitForTimeout(2000);
  await expect(editor.title).toHaveValue('');

  await editor.title.pressSequentially('Shopping list', { delay: 80 });
  await expect(editor.title).toHaveValue('Shopping list');
  await editor.title.press('Enter');

  await expect.poll(() => application.note('Shopping list.md')).toBe('Second note.');
  expect(await application.note('Untitled note 2.md')).toBeNull();
  expect(await application.note('Untitled note.md')).toBe('First note.');
  await expect(editor.title).toHaveValue('Shopping list');
});
