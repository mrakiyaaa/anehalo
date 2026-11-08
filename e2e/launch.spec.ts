import { readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test, expect } from './fixtures';
import { Editor } from './pages/editor';

test('--new-note performs quick capture after a cold start', async ({ application }) => {
  await application.seedSettings({ lastOpenedNotePath: 'Previous.md' });
  await writeFile(join(application.vault, 'Previous.md'), 'Keep the previous note.');
  await application.start(['--new-note']);
  const editor = new Editor(application.page);
  await editor.ready('Untitled note');
  await editor.fill('Created from the command line.');
  await expect
    .poll(() => application.note('Untitled note.md'))
    .toBe('Created from the command line.');
  expect(await application.note('Previous.md')).toBe('Keep the previous note.');
  expect((await readdir(application.vault)).filter((name) => name.endsWith('.md'))).toHaveLength(2);
});

test('--open restores the remembered note without creating a note', async ({ application }) => {
  await application.seedSettings({ lastOpenedNotePath: 'Previous.md' });
  await writeFile(join(application.vault, 'Previous.md'), 'Keep this view.');
  await application.start(['--open']);
  const editor = new Editor(application.page);
  await editor.ready('Previous');
  await expect(editor.content).toContainText('Keep this view.');
  expect((await readdir(application.vault)).filter((name) => name.endsWith('.md'))).toEqual([
    'Previous.md',
  ]);
});
