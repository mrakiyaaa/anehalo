import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { Sidebar } from './pages/sidebar';
import { Diagram } from './pages/diagram';
import { smallDiagram } from './support/diagram-files';
import type { TauriApplication } from './support/tauri-application';
import { startupMarks } from '../src/features/diagnostics/startup-marks';

const workspace = (page: Page) => page.getByRole('main', { name: 'Workspace' });
const card = (page: Page, title: string) =>
  workspace(page)
    .locator('article')
    .filter({ has: page.getByRole('button', { name: `Open ${title}`, exact: true }) });
const thumbnail = (page: Page, title: string) =>
  card(page, title).getByRole('img', { name: `Preview of ${title}` });

async function startWorkspace(application: TauriApplication) {
  await application.start();
  const sidebar = new Sidebar(application.page);
  await sidebar.ready();
  return sidebar;
}

/** Excalidraw's chunks, found the way scripts/check-startup-chunks.mjs finds its code. */
async function excalidrawChunks(): Promise<string[]> {
  const assets = join('dist', 'assets');
  const chunks: string[] = [];
  for (const file of await readdir(assets)) {
    if (!file.endsWith('.js')) continue;
    const content = await readFile(join(assets, file), 'utf8');
    if (
      ['.excalidraw-container', 'excalidraw-modal', 'excalidraw__canvas'].some((marker) =>
        content.includes(marker),
      )
    )
      chunks.push(file);
  }
  return chunks;
}

test('a drawn diagram shows its thumbnail on Home', async ({ application }) => {
  await application.seedSettings();
  await startWorkspace(application);
  const diagram = new Diagram(application.page);
  await diagram.create();
  await diagram.drawRectangle();
  await diagram.saved();

  await application.page.getByRole('button', { name: 'Home', exact: true }).click();

  await expect(thumbnail(application.page, 'Untitled diagram')).toBeVisible({ timeout: 30_000 });
  // Cached in the app's local data folder, never inside the vault.
  const cacheFiles = (await readdir(join(application.root, 'runtime'), { recursive: true })).map(
    (path) => path.replaceAll('\\', '/'),
  );
  expect(cacheFiles.some((path) => path.endsWith('thumbnails/index.json'))).toBe(true);
  expect(cacheFiles.some((path) => /thumbnails\/[0-9a-f]{32}\.img$/.test(path))).toBe(true);
  expect(await readdir(application.vault, { recursive: true })).toEqual([
    'Untitled diagram.excalidraw',
  ]);
});

test('a thumbnail is redrawn after the file changes outside Anehalo', async ({ application }) => {
  await application.seedSettings();
  await writeFile(join(application.vault, 'Flow.excalidraw'), smallDiagram(2));
  await startWorkspace(application);
  const image = thumbnail(application.page, 'Flow');
  await expect(image).toBeVisible({ timeout: 30_000 });
  const before = await image.getAttribute('src');

  await writeFile(join(application.vault, 'Flow.excalidraw'), smallDiagram(6));
  // Anehalo rescans when its window regains focus, as after editing in another app.
  await application.page.evaluate(() => window.dispatchEvent(new Event('focus')));

  await expect.poll(() => image.getAttribute('src'), { timeout: 30_000 }).not.toBe(before);
  await expect(image).toBeVisible();
});

test('the Home filter narrows the grid and is remembered after restart', async ({
  application,
}) => {
  await application.seedSettings();
  await writeFile(join(application.vault, 'Flow.excalidraw'), smallDiagram(1));
  await writeFile(join(application.vault, 'Idea.md'), '# Idea\n\nA thought.');
  await startWorkspace(application);
  const chips = workspace(application.page).getByRole('group', { name: 'Show' });
  await expect(card(application.page, 'Idea')).toBeVisible();
  await expect(card(application.page, 'Flow')).toBeVisible();

  await chips.getByRole('button', { name: 'Diagrams', exact: true }).click();
  await expect(card(application.page, 'Idea')).toHaveCount(0);
  await expect(card(application.page, 'Flow')).toBeVisible();
  await chips.getByRole('button', { name: 'Notes', exact: true }).click();
  await expect(card(application.page, 'Flow')).toHaveCount(0);
  await expect
    .poll(
      async () =>
        (JSON.parse(await readFile(application.settingsPath, 'utf8')) as { homeFilter?: string })
          .homeFilter,
    )
    .toBe('notes');

  await application.restart();
  await new Sidebar(application.page).ready();
  await expect(
    workspace(application.page)
      .getByRole('group', { name: 'Show' })
      .getByRole('button', { name: 'Notes', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(card(application.page, 'Flow')).toHaveCount(0);
  await expect(card(application.page, 'Idea')).toBeVisible();
});

test('500 uncached diagrams: Home is usable before Excalidraw loads, then thumbnails fill in', async ({
  application,
}) => {
  test.setTimeout(120_000);
  await application.seedSettings();
  await Promise.all(
    Array.from({ length: 500 }, (_, index) =>
      writeFile(
        join(application.vault, `Diagram ${index.toString().padStart(3, '0')}.excalidraw`),
        smallDiagram(3),
      ),
    ),
  );
  await startWorkspace(application);
  const firstDiagram = workspace(application.page).locator('article[data-kind="diagram"]').first();
  await expect(firstDiagram).toBeVisible();
  await expect(firstDiagram.getByRole('img')).toBeVisible({ timeout: 60_000 });

  const chunks = await excalidrawChunks();
  expect(chunks.length).toBeGreaterThan(0);
  const timing = await application.page.evaluate(
    ({ usableMark, names }) => ({
      usable: performance.getEntriesByName(usableMark, 'mark')[0]?.startTime ?? null,
      excalidraw: performance
        .getEntriesByType('resource')
        .filter((entry) => names.some((name) => entry.name.endsWith(name)))
        .map((entry) => entry.startTime),
    }),
    { usableMark: startupMarks.usable, names: chunks },
  );
  expect(timing.usable).not.toBeNull();
  // Drawing thumbnails loads Excalidraw, but only after Home was usable.
  expect(timing.excalidraw.length).toBeGreaterThan(0);
  for (const start of timing.excalidraw) expect(start).toBeGreaterThan(timing.usable ?? Infinity);
});

/** Holds settings.json open without sharing, as another program locking it would. */
async function lockFile(path: string) {
  const locker = spawn(
    'powershell.exe',
    [
      '-NoProfile',
      '-Command',
      `$file = [IO.File]::Open('${path.replaceAll("'", "''")}', 'Open', 'ReadWrite', 'None'); [Console]::Out.WriteLine('locked'); [void][Console]::In.ReadLine(); $file.Close()`,
    ],
    { stdio: ['pipe', 'pipe', 'inherit'], windowsHide: true },
  );
  await new Promise<void>((resolve, reject) => {
    locker.stdout.on('data', (chunk: Buffer) => {
      if (chunk.toString().includes('locked')) resolve();
    });
    locker.once('error', reject);
  });
  return async () => {
    locker.stdin.end();
    await once(locker, 'exit');
  };
}

async function expectDefaultWindow(application: TauriApplication) {
  await expect
    .poll(() => application.pageMarkTimes().then((marks) => marks[startupMarks.windowShown]))
    .toBeDefined();
  expect(await application.page.evaluate(() => document.documentElement.dataset.accent)).toBe(
    'sky',
  );
}

test('a corrupt settings file still opens the window with the default appearance', async ({
  application,
}) => {
  await application.seedSettings({ accent: 'rose' });
  await writeFile(application.settingsPath, '{"onboardingCompleted": tr');
  await application.start();
  await expectDefaultWindow(application);
});

test('a locked settings file still opens the window with the default appearance', async ({
  application,
}) => {
  await application.seedSettings({ accent: 'rose' });
  const unlock = await lockFile(application.settingsPath);
  try {
    await application.start();
    await expectDefaultWindow(application);
    await expect(application.page.getByRole('alert')).toBeVisible();
  } finally {
    await unlock();
  }
});
