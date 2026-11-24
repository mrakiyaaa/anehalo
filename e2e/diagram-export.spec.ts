import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { Sidebar } from './pages/sidebar';
import { Diagram } from './pages/diagram';
import { readDiagramFile, textDiagram } from './support/diagram-files';
import { readClipboardImage, excalidrawComFixture } from './support/diagram-transfer';
import { saveNativeDialog } from './support/native-dialog';
import type { TauriApplication } from './support/tauri-application';

const dialogTitles = {
  png: 'Save as PNG image',
  svg: 'Save as SVG image',
  excalidraw: 'Save a copy of the diagram',
} as const;

async function startWithDiagram(
  application: TauriApplication,
  name: string,
  content: string,
  settings: Parameters<TauriApplication['seedSettings']>[0] = {},
) {
  await application.seedSettings(settings);
  await writeFile(join(application.vault, name), content);
  await mkdir(join(application.root, 'exports'), { recursive: true });
  await application.start();
  const sidebar = new Sidebar(application.page);
  await sidebar.ready();
  const diagram = new Diagram(application.page);
  await sidebar.open(name.replace('.excalidraw', ''));
  await diagram.ready();
  return { sidebar, diagram };
}

const exported = (application: TauriApplication, name: string) =>
  join(application.root, 'exports', name);

async function saveThroughDialog(
  application: TauriApplication,
  kind: keyof typeof dialogTitles,
  action: () => Promise<void>,
  fileName: string,
) {
  const destination = exported(application, fileName);
  await Promise.all([
    action(),
    saveNativeDialog(application.processIdentifier, destination, dialogTitles[kind]),
  ]);
  await expect
    .poll(
      async () => {
        const saved = await stat(destination).then(
          () => true,
          () => false,
        );
        if (saved) return true;
        // A failed export says why in its notice; report that instead of a bare timeout.
        const notices = await application.page.getByRole('alert').allInnerTexts();
        if (notices.length > 0) throw new Error(`The export failed: ${notices.join(' | ')}`);
        return false;
      },
      // The first export of a launch loads Excalidraw and draws the whole drawing.
      { timeout: 30_000 },
    )
    .toBe(true);
  return destination;
}

const elementIds = (text: string | null) =>
  readDiagramFile(text)
    .elements.filter((element) => !element.isDeleted)
    .map((element) => element.id)
    .sort();

const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

test('a PNG exported with its scene embedded imports back as the same drawing', async ({
  application,
}) => {
  test.setTimeout(120_000);
  const fixture = await excalidrawComFixture();
  const { diagram } = await startWithDiagram(application, 'Flow.excalidraw', fixture);
  const page = application.page;

  await diagram.openExport();
  await diagram.exportPopover.getByRole('radio', { name: 'PNG' }).check();
  await diagram.exportPopover.getByRole('radio', { name: '1×' }).check();
  await diagram.exportPopover.getByRole('checkbox', { name: /^Embed scene/ }).check();
  const path = await saveThroughDialog(
    application,
    'png',
    () => diagram.exportAction('Save as PNG…').click(),
    'Flow.png',
  );
  await expect(page.getByText('Saved PNG image')).toBeVisible();

  const bytes = await readFile(path);
  expect(bytes.subarray(0, 8)).toEqual(pngSignature);
  expect(bytes.includes('application/vnd.excalidraw+json')).toBe(true);

  // Import the exported image through the picker: it opens as a new diagram with the same shapes.
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page
      .getByRole('main', { name: 'Workspace' })
      .getByRole('button', { name: 'Import diagram…' })
      .click(),
  ]);
  await chooser.setFiles(path);
  await diagram.ready();
  await expect(diagram.title()).toHaveValue('Flow 2');
  await expect
    .poll(async () => elementIds(await application.note('Flow 2.excalidraw')))
    .toEqual(elementIds(fixture));
});

test('an exported SVG embeds its fonts, loads nothing from the network and imports back', async ({
  application,
}) => {
  test.setTimeout(120_000);
  const original = textDiagram([{ id: 'hello', text: 'Fonts travel with the file' }], 2);
  const { diagram } = await startWithDiagram(application, 'Words.excalidraw', original);
  const page = application.page;
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));

  await diagram.openExport();
  await diagram.exportPopover.getByRole('radio', { name: 'SVG' }).check();
  await diagram.exportPopover.getByRole('checkbox', { name: /^Embed scene/ }).check();
  const path = await saveThroughDialog(
    application,
    'svg',
    () => diagram.exportAction('Save as SVG…').click(),
    'Words.svg',
  );
  await expect(page.getByText('Saved SVG image')).toBeVisible();

  const svg = await readFile(path, 'utf8');
  expect(svg).toMatch(/^<svg /);
  expect(svg).toContain('@font-face');
  expect(svg).toMatch(/src: url\(data:font\/woff2;base64,/);
  expect(svg).toContain('Fonts travel with the file');
  expect(svg).toContain('payload-start');
  // Nothing in the file points at a font on the web, and the export made no network request.
  expect(svg).not.toMatch(/url\(["']?https?:/);
  const outside = requests.filter(
    (url) => !/^(data:|blob:|http:\/\/(tauri|ipc|asset)\.localhost)/.test(url),
  );
  expect(outside).toEqual([]);
  // The fixture also fails the test on any console error, which is where a blocked font or
  // script (a CSP violation) would show up.

  await page.getByRole('button', { name: 'Home', exact: true }).click();
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page
      .getByRole('main', { name: 'Workspace' })
      .getByRole('button', { name: 'Import diagram…' })
      .click(),
  ]);
  await chooser.setFiles(path);
  await diagram.ready();
  await expect
    .poll(async () => elementIds(await application.note('Words 2.excalidraw')))
    .toEqual(elementIds(original));
});

test('Copy PNG to clipboard puts an image on the system clipboard', async ({ application }) => {
  test.setTimeout(90_000);
  const { diagram } = await startWithDiagram(
    application,
    'Flow.excalidraw',
    await excalidrawComFixture(),
  );
  await diagram.openExport();
  await diagram.exportPopover.getByRole('radio', { name: '1×' }).check();
  await diagram.exportAction('Copy PNG to clipboard').click();
  await expect(application.page.getByText('Copied PNG to the clipboard')).toBeVisible();

  const image = await readClipboardImage();
  expect(image.hasImage).toBe(true);
  expect(image.width).toBeGreaterThan(50);
  expect(image.height).toBeGreaterThan(50);
});

test('Ctrl+Shift+E opens the Export popover, not Excalidraw’s own export dialog', async ({
  application,
}) => {
  const { diagram } = await startWithDiagram(
    application,
    'Flow.excalidraw',
    await excalidrawComFixture(),
  );
  const page = application.page;

  await page.keyboard.press('Control+Shift+E');
  await expect(diagram.exportPopover.getByText('Export diagram', { exact: true })).toBeVisible();
  await expect(diagram.container.locator('.ImageExportModal, .Modal')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(diagram.exportPopover).toBeHidden();
  // The main menu has no export item either: Export lives in the header.
  const menu = await diagram.openMainMenu();
  await expect(menu).not.toContainText(/export|save/i);
});

test('Excalidraw’s browser save flow is switched off, and Ctrl+Shift+S saves a copy the Anehalo way', async ({
  application,
}) => {
  const fixture = await excalidrawComFixture();
  const { diagram } = await startWithDiagram(application, 'Flow.excalidraw', fixture);
  const page = application.page;

  expect(
    await page.evaluate(() =>
      (window as unknown as { showSaveFilePicker: () => Promise<unknown> })
        .showSaveFilePicker()
        .then(
          () => 'picked',
          (error: Error) => error.name,
        ),
    ),
  ).toBe('AbortError');

  const destination = exported(application, 'Copy.excalidraw');
  await Promise.all([
    page.keyboard.press('Control+Shift+S'),
    saveNativeDialog(application.processIdentifier, destination, dialogTitles.excalidraw),
  ]);
  await expect(page.getByText('Saved a copy of the diagram')).toBeVisible();
  await expect
    .poll(async () => elementIds(await readFile(destination, 'utf8')))
    .toEqual(elementIds(fixture));
  await expect(diagram.title()).toHaveValue('Flow');
});

test('Save a copy as .excalidraw includes edits that are not saved yet', async ({
  application,
}) => {
  const { diagram } = await startWithDiagram(
    application,
    'Flow.excalidraw',
    textDiagram([{ id: 'one', text: 'First' }]),
  );
  await diagram.drawRectangle();
  const path = await saveThroughDialog(
    application,
    'excalidraw',
    async () => {
      await diagram.openExport();
      await diagram.exportAction('Save a copy as .excalidraw…').click();
    },
    'Share.excalidraw',
  );
  expect(readDiagramFile(await readFile(path, 'utf8')).elements.length).toBeGreaterThanOrEqual(2);
});

test('Selection only is offered when something is selected, and the options are remembered', async ({
  application,
}) => {
  const { diagram } = await startWithDiagram(
    application,
    'Flow.excalidraw',
    textDiagram([{ id: 'one', text: 'First' }]),
  );
  const page = application.page;
  const selection = () => diagram.exportPopover.getByRole('checkbox', { name: /^Selection only/ });

  await page.keyboard.press('Escape');
  await diagram.openExport();
  await expect(selection()).toBeDisabled();
  await page.keyboard.press('Escape');

  await diagram.drawRectangle();
  await diagram.openExport();
  await expect(selection()).toBeEnabled();
  await expect(diagram.exportPopover.getByText('1 selected')).toBeVisible();

  await diagram.exportPopover.getByRole('radio', { name: 'SVG' }).check();
  await diagram.exportPopover.getByRole('radio', { name: 'Dark' }).check();
  await diagram.exportPopover.getByRole('checkbox', { name: /^Background/ }).uncheck();
  await selection().check();
  await diagram.exportAction('Copy SVG to clipboard').click();
  await expect(page.getByText('Copied SVG to the clipboard')).toBeVisible();

  // Remembered in settings.json, and offered again after a restart.
  await expect
    .poll(async () => (await application.settings()) as { diagramExport?: unknown })
    .toMatchObject({
      diagramExport: { format: 'svg', theme: 'dark', background: false, scale: 2 },
    });
  await application.restart();
  await new Sidebar(application.page).ready();
  await new Sidebar(application.page).open('Flow');
  const reopened = new Diagram(application.page);
  await reopened.ready();
  await reopened.openExport();
  await expect(reopened.exportPopover.getByRole('radio', { name: 'SVG' })).toBeChecked();
  await expect(reopened.exportPopover.getByRole('radio', { name: 'Dark' })).toBeChecked();
  await expect(
    reopened.exportPopover.getByRole('checkbox', { name: /^Background/ }),
  ).not.toBeChecked();
});

test('the Export button on a note still offers the note actions', async ({ application }) => {
  await application.seedSettings();
  await application.start();
  const sidebar = new Sidebar(application.page);
  await sidebar.ready();
  await sidebar.createNote();
  const page: Page = application.page;
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  for (const name of ['Copy as Markdown', 'Save as PDF'])
    await expect(page.getByRole('menuitem', { name: new RegExp(name) })).toBeVisible();
});
