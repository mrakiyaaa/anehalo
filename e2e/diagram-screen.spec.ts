import { readdir } from 'node:fs/promises';
import { test, expect } from './fixtures';
import { Sidebar } from './pages/sidebar';
import { Diagram } from './pages/diagram';
import { Editor } from './pages/editor';
import type { TauriApplication } from './support/tauri-application';

async function startWorkspace(application: TauriApplication) {
  await application.seedSettings();
  await application.start();
  const sidebar = new Sidebar(application.page);
  await sidebar.ready();
  return { sidebar, diagram: new Diagram(application.page) };
}

async function vaultFiles(application: TauriApplication) {
  return (await readdir(application.vault, { recursive: true }))
    .map((path) => path.replaceAll('\\', '/'))
    .filter((path) => path.endsWith('.excalidraw') && !path.startsWith('.trash'))
    .sort();
}

test('New diagram from the sidebar, Home, a folder menu and Ctrl+Alt+D opens it in its folder', async ({
  application,
}) => {
  const { sidebar, diagram } = await startWorkspace(application);
  await sidebar.createFolder('Plans');

  await diagram.create();
  await expect(diagram.title()).toHaveValue('Untitled diagram');
  await expect(diagram.screen.getByTitle('Plans')).toBeVisible();

  await application.page.getByRole('button', { name: 'Home', exact: true }).click();
  await diagram.createFromHome();
  await expect(diagram.title()).toHaveValue('Untitled diagram 2');

  await sidebar.newDiagramIn('Plans');
  await diagram.ready();
  await expect(diagram.title()).toHaveValue('Untitled diagram 3');

  await sidebar.selectFolder('All items');
  await application.page.keyboard.press('Control+Alt+d');
  await diagram.ready();
  await expect(diagram.screen.getByTitle('Vault root')).toBeVisible();

  expect(await vaultFiles(application)).toEqual([
    'Plans/Untitled diagram 2.excalidraw',
    'Plans/Untitled diagram 3.excalidraw',
    'Plans/Untitled diagram.excalidraw',
    'Untitled diagram.excalidraw',
  ]);
});

test('renaming a diagram through its title renames the file', async ({ application }) => {
  const { sidebar, diagram } = await startWorkspace(application);
  await diagram.create();
  await diagram.title().fill('Release pipeline');
  await diagram.title().press('Enter');

  await expect(
    sidebar.items.getByRole('button', { name: 'Release pipeline', exact: true }),
  ).toBeVisible();
  expect(await vaultFiles(application)).toEqual(['Release pipeline.excalidraw']);
});

test('back and forward move between a note and a diagram', async ({ application }) => {
  const { sidebar, diagram } = await startWorkspace(application);
  const editor = new Editor(application.page);
  await sidebar.createNote();
  await expect(editor.title).toHaveValue('Untitled note');
  await diagram.create();

  await application.page.keyboard.press('Alt+ArrowLeft');
  await expect(editor.title).toHaveValue('Untitled note');

  await application.page.getByRole('button', { name: 'Forward', exact: true }).click();
  await diagram.ready();
  await expect(diagram.title()).toHaveValue('Untitled diagram');

  await application.page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(editor.title).toHaveValue('Untitled note');
});

test('app shortcuts work on a diagram but stay quiet while typing diagram text', async ({
  application,
}) => {
  const { diagram } = await startWorkspace(application);
  await diagram.create();
  const search = application.page.getByRole('combobox', { name: 'Search notes and diagrams' });

  await diagram.startText('Ctrl');
  for (const shortcut of ['Control+k', 'Control+Alt+n', 'Control+Alt+d', 'Alt+ArrowLeft'])
    await application.page.keyboard.press(shortcut);
  await application.page.keyboard.press('Escape');

  await expect(search).toBeHidden();
  await expect(diagram.title()).toHaveValue('Untitled diagram');
  expect(await vaultFiles(application)).toEqual(['Untitled diagram.excalidraw']);
  await diagram.expectElementCount(1);

  await application.page.keyboard.press('Control+k');
  await expect(search).toBeVisible();
});

test('--new-diagram reaches the running app and opens a diagram in the same window', async ({
  application,
}) => {
  await application.seedSettings();
  await application.startSingleInstance();
  await new Sidebar(application.page).ready();
  const diagram = new Diagram(application.page);

  await application.launchAgain(['--new-diagram']);

  await diagram.ready();
  await expect(diagram.title()).toHaveValue('Untitled diagram');
  expect(await vaultFiles(application)).toEqual(['Untitled diagram.excalidraw']);
});
