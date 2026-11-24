import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { Sidebar } from './pages/sidebar';
import { Diagram } from './pages/diagram';
import { SearchPalette } from './pages/search-palette';
import { noisePng } from './support/diagram-files';
import {
  droppedText,
  dragFilesOver,
  dropFiles,
  excalidrawComFixture,
} from './support/diagram-transfer';
import type { TauriApplication } from './support/tauri-application';

const sha256 = (content: Buffer | string) => createHash('sha256').update(content).digest('hex');

/** A file outside the vault, as a person would have in Downloads. */
async function writeOutside(application: TauriApplication, name: string, content: string) {
  const directory = join(application.root, 'incoming');
  await mkdir(directory, { recursive: true });
  const path = join(directory, name);
  await writeFile(path, content);
  return path;
}

async function start(application: TauriApplication, folders: readonly string[] = []) {
  await application.seedSettings();
  for (const folder of folders) await mkdir(join(application.vault, folder), { recursive: true });
  await application.start();
  const sidebar = new Sidebar(application.page);
  await sidebar.ready();
  return {
    sidebar,
    diagram: new Diagram(application.page),
    search: new SearchPalette(application.page),
  };
}

const workspace = (page: Page) => page.getByRole('main', { name: 'Workspace' });

test('importing an excalidraw.com file from the folder menu opens it, with a thumbnail and search', async ({
  application,
}) => {
  test.setTimeout(90_000);
  const fixture = await excalidrawComFixture();
  const source = await writeOutside(application, 'Architecture.excalidraw', fixture);
  const before = sha256(await readFile(source));
  const { diagram, search } = await start(application, ['Work']);
  const page = application.page;

  await page
    .getByRole('navigation', { name: 'Folders' })
    .getByRole('button', { name: 'Actions for Work', exact: true })
    .click();
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('menuitem', { name: 'Import diagram here', exact: true }).click(),
  ]);
  await chooser.setFiles(source);

  // A single import opens the diagram, titled by the original file name.
  await diagram.ready();
  await expect(diagram.title()).toHaveValue('Architecture');
  await expect(page.getByText('Imported “Architecture”')).toBeVisible();
  expect(await application.note('Work/Architecture.excalidraw')).toBe(fixture);

  // The original was only read.
  expect(sha256(await readFile(source))).toBe(before);

  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await expect(workspace(page).getByRole('img', { name: 'Preview of Architecture' })).toBeVisible({
    timeout: 30_000,
  });

  await search.open();
  await search.query('Start');
  await search.expectResult('Architecture');
});

test('importing from Home and from the sidebar both reach the file picker', async ({
  application,
}) => {
  const fixture = await excalidrawComFixture();
  const first = await writeOutside(application, 'First.excalidraw', fixture);
  const second = await writeOutside(application, 'Second.excalidraw', fixture);
  const third = await writeOutside(application, 'Third.excalidraw', fixture);
  const { sidebar, diagram } = await start(application);
  const page = application.page;

  const [fromHome] = await Promise.all([
    page.waitForEvent('filechooser'),
    workspace(page).getByRole('button', { name: 'Import diagram…' }).click(),
  ]);
  expect(fromHome.isMultiple()).toBe(true);
  await fromHome.setFiles(first);
  await diagram.ready();

  const [fromSidebar] = await Promise.all([
    page.waitForEvent('filechooser'),
    page
      .getByRole('complementary', { name: 'Sidebar' })
      .getByRole('button', { name: 'Import diagram…' })
      .click(),
  ]);
  // Several files at once: the screen stays on the open diagram and the list gains both.
  await fromSidebar.setFiles([second, third]);
  await expect(page.getByText('2 imported')).toBeVisible();
  await expect(diagram.title()).toHaveValue('First');
  await expect(sidebar.items.getByRole('button', { name: 'Second', exact: true })).toBeVisible();
  await expect(sidebar.items.getByRole('button', { name: 'Third', exact: true })).toBeVisible();
});

test('dropping two files, one valid and one not, imports one and says why the other was skipped', async ({
  application,
}) => {
  const fixture = await excalidrawComFixture();
  const { sidebar } = await start(application);
  const page = application.page;
  const files = [
    droppedText('Dropped.excalidraw', fixture),
    droppedText('Broken.excalidraw', '{"type":"excalidraw","elements":['),
  ];

  await dragFilesOver(page, files);
  await expect(page.getByText('Drop to import diagrams')).toBeVisible();
  await dropFiles(page, files);

  const toast = page.getByText(/1 imported, 1 skipped/);
  await expect(toast).toBeVisible();
  await expect(toast).toContainText(
    'Broken.excalidraw: This file is not a valid Excalidraw drawing.',
  );
  await expect(page.getByText('Drop to import diagrams')).toBeHidden();
  await expect(sidebar.items.getByRole('button', { name: 'Dropped', exact: true })).toBeVisible();
  expect(await application.note('Dropped.excalidraw')).toBe(fixture);
  expect(await application.note('Broken.excalidraw')).toBeNull();
  // Several files at once: still on Home.
  await expect(workspace(page)).toBeVisible();
});

test('an image without diagram data is refused with a clear message and nothing is written', async ({
  application,
}) => {
  await start(application);
  const photo = noisePng(8, 8);
  await dropFiles(application.page, [
    { name: 'photo.png', base64: photo.toString('base64'), type: 'image/png' },
  ]);
  await expect(
    application.page
      .getByRole('alert')
      .filter({ hasText: 'This image has no diagram data to import.' }),
  ).toBeVisible();
  expect(await application.note('photo.excalidraw')).toBeNull();

  // A damaged image is told apart from one that simply holds no drawing.
  const damaged = Buffer.from(photo);
  damaged[41] = (damaged[41] ?? 0) ^ 0xff;
  await dropFiles(application.page, [
    { name: 'damaged.png', base64: damaged.toString('base64'), type: 'image/png' },
  ]);
  await expect(
    application.page.getByRole('alert').filter({ hasText: 'This PNG image is damaged' }),
  ).toBeVisible();
  expect(await application.note('damaged.excalidraw')).toBeNull();
});

test('only .excalidraw files dropped on an open diagram are imported, never loaded over it', async ({
  application,
}) => {
  const fixture = await excalidrawComFixture();
  const { diagram, sidebar } = await start(application);
  await diagram.create();
  await diagram.drawRectangle();
  await diagram.saved();
  await diagram.expectElementCount(1);

  await dropFiles(application.page, [droppedText('Other.excalidraw', fixture)]);

  // Excalidraw's own drop handling would have replaced the open drawing with this one.
  await expect(diagram.title()).toHaveValue('Other');
  await expect(
    sidebar.items.getByRole('button', { name: 'Untitled diagram', exact: true }),
  ).toBeVisible();
  expect(await application.note('Other.excalidraw')).toBe(fixture);
  expect(JSON.parse((await application.note('Untitled diagram.excalidraw')) ?? '{}')).toMatchObject(
    {
      type: 'excalidraw',
    },
  );
});
