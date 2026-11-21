import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { Sidebar } from './pages/sidebar';
import { Diagram } from './pages/diagram';
import { Editor } from './pages/editor';
import { SearchPalette } from './pages/search-palette';
import { readDiagramFile, textDiagram } from './support/diagram-files';
import type { TauriApplication } from './support/tauri-application';

async function startWithVault(application: TauriApplication, files: Record<string, string>) {
  await application.seedSettings();
  for (const [path, content] of Object.entries(files)) {
    const absolute = join(application.vault, path);
    await mkdir(join(absolute, '..'), { recursive: true });
    await writeFile(absolute, content);
  }
  await application.start();
  const sidebar = new Sidebar(application.page);
  await sidebar.ready();
  return {
    sidebar,
    diagram: new Diagram(application.page),
    search: new SearchPalette(application.page),
  };
}

const focusedElement = (page: Page) =>
  page.locator('.diagram-canvas').getAttribute('data-focused-element');

/** A diagram row: a note can match the same words, for example through an embed's title. */
async function expectDiagramResult(page: Page, title: string) {
  const results = page.getByRole('listbox', { name: 'Search results' });
  await expect(results).toHaveAttribute('aria-busy', 'false');
  await expect(
    results.locator('[role="option"][data-kind="diagram"]').filter({ hasText: title }),
  ).toBeVisible();
}

const resultTitles = async (page: Page) =>
  page
    .getByRole('listbox', { name: 'Search results' })
    .getByRole('option')
    .locator('strong')
    .allInnerTexts();

test('Ctrl+K finds text typed into a diagram and opens it on that element', async ({
  application,
}) => {
  const { diagram, search } = await startWithVault(application, {});
  await diagram.create();
  await diagram.writeText('Payment gateway');
  await diagram.saved();
  const saved = readDiagramFile(await application.note('Untitled diagram.excalidraw'));
  const textId = saved.elements.find((element) => element.type === 'text')?.id;
  expect(textId).toBeDefined();
  await application.page.getByRole('button', { name: 'Home', exact: true }).click();

  await search.open();
  await search.query('gateway');
  await search.expectResult('Untitled diagram');
  await search.choose('Untitled diagram');
  await diagram.ready();
  await expect.poll(() => focusedElement(application.page)).toBe(textId);
  await expect(diagram.title()).toHaveValue('Untitled diagram');

  // Back and forward still move between the items visited.
  await new Sidebar(application.page).createNote();
  const editor = new Editor(application.page);
  await expect(editor.title).toHaveValue('Untitled note');
  await application.page.getByRole('button', { name: 'Back', exact: true }).click();
  await diagram.ready();
  await expect(diagram.title()).toHaveValue('Untitled diagram');
  await application.page.getByRole('button', { name: 'Forward', exact: true }).click();
  await expect(editor.title).toHaveValue('Untitled note');
});

test('a match inside a shape selects the shape, and Sinhala and Tamil text is found', async ({
  application,
}) => {
  const { diagram, search } = await startWithVault(application, {
    'Plans/Checkout.excalidraw': textDiagram([
      { id: 'label', text: 'Payment gateway', inBox: 'box' },
      { id: 'si', text: 'ගෙවීම් ද්වාරය' },
      { id: 'ta', text: 'கட்டண நுழைவாயில்' },
    ]),
  });
  for (const [query, element] of [
    ['ද්වාරය', 'si'],
    ['நுழைவாயில்', 'ta'],
    ['gateway', 'box'],
  ] as const) {
    await search.open();
    await search.query(query);
    await search.expectResult('Checkout');
    await search.choose('Checkout');
    await diagram.ready();
    await expect.poll(() => focusedElement(application.page)).toBe(element);
    await application.page.getByRole('button', { name: 'Home', exact: true }).click();
  }
});

test('search follows a rename, trash and restore, and edits made outside Anehalo', async ({
  application,
}) => {
  const { sidebar, search } = await startWithVault(application, {
    'Flow.excalidraw': textDiagram([{ id: 'a', text: 'Payment gateway' }]),
    'Plan.md': 'Intro\n\n![Flow](Flow.excalidraw)',
  });
  const page = application.page;

  await sidebar.rename('diagram', 'Flow', 'Checkout pipeline');
  await search.open();
  await search.query('pipeline');
  await expectDiagramResult(page, 'Checkout pipeline');
  await search.query('gateway');
  await expectDiagramResult(page, 'Checkout pipeline');
  await search.close();

  await sidebar.delete('diagram', 'Checkout pipeline');
  await search.open();
  await search.query('gateway');
  await expect(page.getByRole('listbox', { name: 'Search results' })).toContainText(
    'Nothing found',
  );
  await search.close();
  await sidebar.open('Plan');
  await page.locator('figure.diagram-embed').getByRole('button', { name: 'Restore' }).click();
  await search.open();
  await search.query('gateway');
  await expectDiagramResult(page, 'Checkout pipeline');
  await search.close();

  await writeFile(
    join(application.vault, 'Checkout pipeline.excalidraw'),
    textDiagram([{ id: 'a', text: 'Fraud screening' }]),
  );
  // Anehalo rescans when its window regains focus, as after editing in another app.
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await search.open();
  await search.query('fraud');
  await expectDiagramResult(page, 'Checkout pipeline');
  await search.query('gateway');
  await expect.poll(() => resultTitles(page)).toEqual([]);
});

test('Ctrl+F on a diagram opens the canvas search, not the note find bar', async ({
  application,
}) => {
  const { sidebar, diagram } = await startWithVault(application, {
    'Flow.excalidraw': textDiagram([{ id: 'a', text: 'Payment gateway' }]),
  });
  await sidebar.open('Flow');
  await diagram.ready();
  await application.page.keyboard.press('Control+f');
  const canvasSearch = application.page.locator('.layer-ui__search');
  await expect(canvasSearch).toBeVisible();
  await canvasSearch.getByRole('textbox').fill('gateway');
  await expect(application.page.locator('.layer-ui__search-count')).toContainText('1');
  await expect(application.page.getByRole('search', { name: 'Find in note' })).toHaveCount(0);
});
