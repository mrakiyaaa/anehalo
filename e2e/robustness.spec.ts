import { open, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test, expect } from './fixtures';
import { Sidebar } from './pages/sidebar';
import { Editor } from './pages/editor';
import { writeImageFixture } from './support/image-fixture';

test('long titles are bounded and special characters and emoji remain safe', async ({
  application,
}) => {
  await application.seedSettings();
  await application.start();
  await new Sidebar(application.page).createNote();
  const editor = new Editor(application.page);
  await editor.name('🌼'.repeat(1000));
  await editor.fill('A long title');
  await expect.poll(() => application.note(`${'🌼'.repeat(80)}.md`)).toBe('A long title');
  await editor.name('සිංහල 🌼 plan:*? "today"');
  await expect.poll(() => application.note('සිංහල 🌼 plan today.md')).toBe('A long title');
});

test('a 1 MB note can be edited and survives restart', async ({ application }) => {
  test.setTimeout(90_000);
  await application.seedSettings({ lastOpenedNotePath: 'Large.md' });
  const paragraph = 'A large plain text note. ';
  const original = paragraph
    .repeat(Math.ceil((1024 * 1024) / paragraph.length))
    .slice(0, 1024 * 1024);
  await writeFile(join(application.vault, 'Large.md'), original);
  await application.start();
  let editor = new Editor(application.page);
  await expect(editor.title).toHaveValue('Large');
  await editor.append(' Final thought.');
  await expect
    .poll(() => application.note('Large.md'), { timeout: 30_000 })
    .toBe(`${original} Final thought.`);
  await application.restart();
  editor = new Editor(application.page);
  await expect(editor.content).toContainText('Final thought.');
});

test('a read-only vault keeps unsaved text, blocks closing, and recovers after access is restored', async ({
  application,
}) => {
  await application.seedSettings({ lastOpenedNotePath: 'Protected.md' });
  await writeFile(join(application.vault, 'Protected.md'), 'Original text');
  await application.start();
  const editor = new Editor(application.page);
  await editor.ready('Protected');
  const baseline = await open(join(application.vault, 'Protected.md'), 'r');
  await application.setVaultReadOnly(true);
  try {
    await editor.fill('Private unsaved thought');
    await editor.closeWindow();
    await editor.expectSaveError();
    await expect(editor.content).toContainText('Private unsaved thought');
    expect(await baseline.readFile('utf8')).toBe('Original text');
    await expect.poll(() => application.log()).toContain('save-failed');
    expect(await application.log()).not.toContain('Private unsaved thought');
  } finally {
    await baseline.close();
    await application.setVaultReadOnly(false);
  }
  await editor.retrySave();
  await expect.poll(() => application.note('Protected.md')).toBe('Private unsaved thought');
});

test('a vault removed while running retains the draft and resumes after restoration', async ({
  application,
}) => {
  await application.seedSettings({ lastOpenedNotePath: 'Moved.md' });
  await writeFile(join(application.vault, 'Moved.md'), 'Original text');
  await application.start();
  const editor = new Editor(application.page);
  await editor.ready('Moved');
  const image = await writeImageFixture(application.root);
  const movedVault = join(application.root, 'moved-vault');
  await rename(application.vault, movedVault);
  try {
    await editor.fill('Keep this after the vault disappeared');
    await editor.closeWindow();
    await editor.expectMissing();
    await expect(editor.content).toContainText('Keep this after the vault disappeared');
    await editor.addImage(image.path);
    await editor.expectImageError();
    expect(await application.vaultExists()).toBe(false);
  } finally {
    await rename(movedVault, application.vault);
  }
  await editor.checkAgain();
  await expect
    .poll(() => application.note('Moved.md'))
    .toBe('Keep this after the vault disappeared');
});
