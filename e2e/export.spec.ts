import { mkdir, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test, expect } from './fixtures';
import { Sidebar } from './pages/sidebar';
import { Editor } from './pages/editor';
import { saveNativeDialog } from './support/native-dialog';
import { writeImageFixture } from './support/image-fixture';

test('Markdown export saves the file and its image assets through the native save dialog', async ({
  application,
}) => {
  await application.seedSettings();
  const image = await writeImageFixture(application.root);
  const exportDirectory = join(application.root, 'exports');
  await mkdir(exportDirectory);
  await application.start();
  await new Sidebar(application.page).createNote();
  const editor = new Editor(application.page);
  await editor.name('Shared note');
  await expect(editor.title).toHaveValue('Shared note');
  await editor.fill('A note with an image.');
  await expect(editor.title).toHaveValue('Shared note');
  await editor.addImage(image.path);
  await expect(editor.title).toHaveValue('Shared note');
  await expect.poll(() => application.note('Shared note.md')).toContain('.attachments/');
  const destination = join(exportDirectory, 'Shared note.md');
  await Promise.all([
    editor.exportMarkdown(),
    saveNativeDialog(application.processIdentifier, destination),
  ]);
  await expect(async () =>
    expect(await readFile(destination, 'utf8')).toContain('Shared%20note_assets/'),
  ).toPass({ timeout: 10_000 });
  const assets = await readdir(join(exportDirectory, 'Shared note_assets'));
  expect(assets).toHaveLength(1);
  expect(await readFile(join(exportDirectory, 'Shared note_assets', assets[0] ?? ''))).toEqual(
    image.bytes,
  );
});
