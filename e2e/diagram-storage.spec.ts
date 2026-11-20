import { copyFile, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { test, expect } from './fixtures';
import { Sidebar } from './pages/sidebar';
import { Diagram } from './pages/diagram';
import { readDiagramFile, smallDiagram } from './support/diagram-files';
import type { TauriApplication } from './support/tauri-application';

const newDiagramPath = 'Untitled diagram.excalidraw';
const fixtures = resolve('src/features/diagrams/fixtures');

async function startWorkspace(application: TauriApplication) {
  await application.seedSettings();
  await application.start();
  const sidebar = new Sidebar(application.page);
  await sidebar.ready();
  return { sidebar, diagram: new Diagram(application.page) };
}

test('a new diagram is saved as an Excalidraw file and reopens identically after restart', async ({
  application,
}) => {
  const { diagram } = await startWorkspace(application);
  await diagram.create();
  await diagram.drawRectangle();
  await diagram.expectElementCount(1);
  await diagram.saved();

  const saved = await application.note(newDiagramPath);
  const file = readDiagramFile(saved);
  expect(file).toMatchObject({
    type: 'excalidraw',
    source: 'https://github.com/mrakiyaaa/anehalo',
  });
  expect(file.elements.filter((element) => !element.isDeleted).map(({ type }) => type)).toEqual([
    'rectangle',
  ]);

  await application.restart();
  const sidebar = new Sidebar(application.page);
  await sidebar.ready();
  const reopened = new Diagram(application.page);
  await sidebar.open('Untitled diagram');
  await reopened.ready();
  await reopened.expectElementCount(1);
  await reopened.saved();
  expect(await application.note(newDiagramPath)).toBe(saved);
});

test('an outside edit while unsaved shows the conflict banner and is never overwritten', async ({
  application,
}) => {
  const { diagram } = await startWorkspace(application);
  await diagram.create();
  await diagram.drawRectangle();
  await diagram.saved();
  const outside = smallDiagram(3);
  await writeFile(join(application.vault, newDiagramPath), outside);

  await diagram.drawRectangle();

  await expect(diagram.alert()).toContainText('This diagram changed outside Anehalo.');
  expect(await application.note(newDiagramPath)).toBe(outside);
  await diagram.keepMine();
  await diagram.saved();
  expect(readDiagramFile(await application.note(newDiagramPath)).elements).toHaveLength(2);
});

test('deleting a diagram from the sidebar moves it to the vault trash', async ({ application }) => {
  const { sidebar, diagram } = await startWorkspace(application);
  await diagram.create();
  await diagram.drawRectangle();
  await diagram.saved();

  await sidebar.delete('diagram', 'Untitled diagram');

  await expect(application.page.getByRole('main', { name: 'Workspace' })).toBeVisible();
  expect(await application.note(newDiagramPath)).toBeNull();
  const trashed = await readdir(join(application.vault, '.trash'), { recursive: true });
  expect(trashed.some((path) => path.endsWith(newDiagramPath))).toBe(true);
});

test('a file exported from excalidraw.com opens with every element', async ({ application }) => {
  await application.seedSettings();
  await copyFile(
    join(fixtures, 'excalidraw-com-export.excalidraw'),
    join(application.vault, 'From excalidraw.com.excalidraw'),
  );
  await application.start();
  const sidebar = new Sidebar(application.page);
  await sidebar.ready();
  const diagram = new Diagram(application.page);

  await sidebar.open('From excalidraw.com');
  await diagram.ready();

  await diagram.expectElementCount(6);
  await diagram.saved();
});

test('a corrupt diagram shows an error and its bytes stay exactly as they were', async ({
  application,
}) => {
  await application.seedSettings();
  const corrupt = join(application.vault, 'Broken.excalidraw');
  await copyFile(join(fixtures, 'truncated.excalidraw'), corrupt);
  const original = await readFile(corrupt);
  await application.start();
  const sidebar = new Sidebar(application.page);
  await sidebar.ready();
  const diagram = new Diagram(application.page);

  await sidebar.open('Broken');

  await expect(diagram.alert()).toContainText('This diagram can’t be opened.');
  await expect(diagram.alert()).toContainText('The file was not changed.');
  expect(await readFile(corrupt)).toEqual(original);
});
