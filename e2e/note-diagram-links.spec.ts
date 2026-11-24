import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { Sidebar } from './pages/sidebar';
import { Editor } from './pages/editor';
import { Diagram } from './pages/diagram';
import { smallDiagram } from './support/diagram-files';
import { saveNativeDialog } from './support/native-dialog';
import type { TauriApplication } from './support/tauri-application';

const planNote = [
  'Intro',
  '',
  '![Release flow](Plans/Release%20flow.excalidraw)',
  '',
  'See [Release flow](Plans/Release%20flow.excalidraw) for details.',
].join('\n');

/** A diagram whose first shape links to a vault note. */
function diagramLinkingTo(path: string): string {
  const file = JSON.parse(smallDiagram(2)) as { elements: { link: string | null }[] };
  const [first] = file.elements;
  if (!first) throw new Error('The diagram fixture has no elements.');
  first.link = path;
  return JSON.stringify(file);
}

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
  return { sidebar, editor: new Editor(application.page), diagram: new Diagram(application.page) };
}

const embed = (page: Page, title: string) =>
  page.locator('figure.diagram-embed').filter({ hasText: title });

test('an embedded diagram previews in the note, opens, and lists the note as a backlink', async ({
  application,
}) => {
  const { sidebar, editor, diagram } = await startWithVault(application, {
    'Plan.md': planNote,
    'Plans/Release flow.excalidraw': smallDiagram(3),
  });
  await sidebar.open('Plan');
  const preview = embed(application.page, 'Release flow');
  await expect(preview.getByRole('img', { name: 'Preview of Release flow' })).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    editor.content.getByRole('button', { name: 'Release flow', exact: true }),
  ).toBeVisible();

  await preview.getByRole('button', { name: 'Open diagram Release flow' }).click();
  await diagram.ready();
  await expect(diagram.title()).toHaveValue('Release flow');
  const backlinks = application.page.locator('.backlinks-panel');
  await backlinks.locator('summary').click();
  await expect(backlinks.getByRole('button').filter({ hasText: 'Plan' })).toBeVisible();
});

test('replacing all of a note that holds an embed saves the new text', async ({ application }) => {
  const { sidebar, editor } = await startWithVault(application, {
    'Plan.md': planNote,
    'Plans/Release flow.excalidraw': smallDiagram(1),
  });
  await sidebar.open('Plan');
  await expect(embed(application.page, 'Release flow')).toBeVisible();
  await editor.fill('Only this text now.');
  await expect.poll(() => application.note('Plan.md')).toBe('Only this text now.');
});

test('renames keep links, embeds and element links correct in both directions', async ({
  application,
}) => {
  const { sidebar, editor } = await startWithVault(application, {
    'Plan.md': planNote,
    'Plans/Release flow.excalidraw': smallDiagram(1),
    'Map.excalidraw': diagramLinkingTo('Plan.md'),
  });
  // A label that was the old title follows the rename, as note links always have.
  const newTitle = 'සිංහල රූපය';
  await sidebar.rename('diagram', 'Release flow', newTitle);
  const renamedPath = `Plans/${encodeURIComponent(newTitle)}.excalidraw`;
  await expect.poll(() => application.note('Plan.md')).toContain(`![${newTitle}](${renamedPath})`);
  expect(await application.note('Plan.md')).toContain(`[${newTitle}](${renamedPath}) for details`);
  expect(await application.note('Plan.md')).not.toContain('Release%20flow.excalidraw');

  await sidebar.rename('note', 'Plan', 'திட்டம்');
  // Element links keep their spelling; this one was written unencoded.
  await expect
    .poll(async () => {
      const map = JSON.parse((await application.note('Map.excalidraw')) ?? '{}') as {
        elements?: { link: string | null }[];
      };
      return map.elements?.[0]?.link;
    })
    .toBe('திட்டம்.md');

  await sidebar.open('திட்டம்');
  await expect(
    embed(application.page, newTitle).getByRole('img', { name: `Preview of ${newTitle}` }),
  ).toBeVisible({ timeout: 30_000 });
  await editor.expectBacklink('Map');
});

test('a trashed diagram shows as in trash in the note and can be restored from there', async ({
  application,
}) => {
  const { sidebar, editor } = await startWithVault(application, {
    'Plan.md': planNote,
    'Plans/Release flow.excalidraw': smallDiagram(1),
  });
  await sidebar.delete('diagram', 'Release flow');
  await sidebar.open('Plan');
  const preview = embed(application.page, 'Release flow');
  await expect(preview.getByText('Diagram is in trash')).toBeVisible();
  await preview.getByRole('button', { name: 'Restore' }).click();
  await expect(preview.getByRole('img', { name: 'Preview of Release flow' })).toBeVisible({
    timeout: 30_000,
  });
  expect(await application.note('Plans/Release flow.excalidraw')).not.toBeNull();
  expect(await application.note('Plan.md')).toBe(planNote);
  await expect(editor.title).toHaveValue('Plan');
});

test('export draws embeds as PNGs, and replaces an unreadable diagram with a placeholder', async ({
  application,
}) => {
  const note = `${planNote}\n\n![Broken](Broken.excalidraw)`;
  const brokenDiagram = '{"type":"excal';
  const { sidebar, editor } = await startWithVault(application, {
    'Plan.md': note,
    'Plans/Release flow.excalidraw': smallDiagram(3),
    'Broken.excalidraw': brokenDiagram,
  });
  const exportDirectory = join(application.root, 'exports');
  await mkdir(exportDirectory);
  await sidebar.open('Plan');
  const destination = join(exportDirectory, 'Plan.md');
  await Promise.all([
    editor.exportMarkdown(),
    saveNativeDialog(application.processIdentifier, destination),
  ]);
  await expect(
    application.page
      .getByRole('alert')
      .filter({ hasText: 'Exported without a diagram that could not be drawn: Broken.' }),
  ).toBeVisible({ timeout: 30_000 });

  const exported = await readFile(destination, 'utf8');
  expect(exported).toContain('Diagram unavailable: Broken');
  expect(exported).not.toContain('.excalidraw');
  const assets = await readdir(join(exportDirectory, 'Plan_assets'));
  expect(assets).toEqual(['Release flow.png']);
  const png = await readFile(join(exportDirectory, 'Plan_assets', 'Release flow.png'));
  expect([...png.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  // The originals are never written by an export.
  expect(await application.note('Plan.md')).toBe(note);
  expect(await application.note('Broken.excalidraw')).toBe(brokenDiagram);
});

test('the window never opens popups or leaves the app page', async ({ application }) => {
  await startWithVault(application, {});
  const page = application.page;
  const appUrl = page.url();

  await page.evaluate(() => {
    window.open('https://example.com/', '_blank');
  });
  await expect.poll(() => application.log()).toContain('event=new-window-blocked');
  expect(page.context().pages()).toHaveLength(1);

  // A real click: Chromium drops scripted popups without a user gesture before the guard runs.
  await page.evaluate(() => {
    const link = document.createElement('a');
    link.href = 'https://example.com/';
    link.target = '_blank';
    link.textContent = 'Popup link';
    link.style.cssText = 'position:fixed;inset:0 auto auto 0;z-index:2147483647';
    document.body.append(link);
  });
  await page.getByRole('link', { name: 'Popup link' }).click();
  await page.evaluate(() => document.querySelector('a[target="_blank"]')?.remove());
  await expect
    .poll(async () => (await application.log()).split('event=new-window-blocked').length - 1)
    .toBe(2);

  await page.evaluate(() => {
    window.location.assign('https://example.com/');
  });
  await expect.poll(() => application.log()).toContain('event=navigation-blocked');
  expect(page.url()).toBe(appUrl);
  expect(page.context().pages()).toHaveLength(1);
  await new Sidebar(page).ready();
});
