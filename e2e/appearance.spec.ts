import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { Sidebar } from './pages/sidebar';
import { Diagram } from './pages/diagram';
import { accentPalette, type AccentId } from '../src/features/theme/accent-palette';
import type { TauriApplication } from './support/tauri-application';
import { startupMarks } from '../src/features/diagnostics/startup-marks';

async function startWorkspace(application: TauriApplication) {
  await application.seedSettings();
  await application.start();
  const sidebar = new Sidebar(application.page);
  await sidebar.ready();
  return sidebar;
}

function rootVariable(page: Page, name: string) {
  return page.evaluate(
    (variable) => getComputedStyle(document.documentElement).getPropertyValue(variable).trim(),
    name,
  );
}

/** The quick note button is filled with the accent's soft colour. */
function quickNoteBackground(page: Page) {
  return page
    .getByRole('button', { name: 'Quick note', exact: true })
    .evaluate((button) => getComputedStyle(button).backgroundColor);
}

function rgb(hex: string) {
  const [red, green, blue] = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
  return `rgb(${red}, ${green}, ${blue})`;
}

async function pickAccent(page: Page, name: string) {
  await page.getByRole('button', { name: 'Accent color', exact: true }).click();
  await page.getByRole('radio', { name: `Accent color: ${name}`, exact: true }).click();
  await page.keyboard.press('Escape');
}

async function savedSettings(application: TauriApplication) {
  return JSON.parse(await readFile(application.settingsPath, 'utf8')) as {
    accent?: AccentId;
    sidebarCollapsed?: boolean;
  };
}

test('an accent picked in the title bar applies at once and is there from the first frame after restart', async ({
  application,
}) => {
  await startWorkspace(application);
  const mint = accentPalette.mint.modes.light;

  await pickAccent(application.page, 'Mint');

  expect(await rootVariable(application.page, '--accent-strong')).toBe(mint.strong);
  await expect.poll(() => quickNoteBackground(application.page)).toBe(rgb(mint.soft));
  await expect.poll(async () => (await savedSettings(application)).accent).toBe('mint');

  await application.restart();
  // The harness connects before the window is visible, so the check is on ordering: settings.json
  // (and its accent) was applied before the window was shown, even though the hard stop above can
  // lose the localStorage copy.
  await expect
    .poll(() => application.pageMarkTimes().then((marks) => marks[startupMarks.windowShown]))
    .toBeDefined();
  const marks = await application.pageMarkTimes();
  expect(marks[startupMarks.settingsApplied]).toBeLessThanOrEqual(
    marks[startupMarks.windowShown] ?? 0,
  );
  expect(await rootVariable(application.page, '--accent-strong')).toBe(mint.strong);
  await new Sidebar(application.page).ready();
  expect(await quickNoteBackground(application.page)).toBe(rgb(mint.soft));
});

test('an open diagram follows a new accent live', async ({ application }) => {
  await startWorkspace(application);
  const diagram = new Diagram(application.page);
  await diagram.create();
  const excalidrawPrimary = () =>
    diagram.container.evaluate((element) =>
      getComputedStyle(element).getPropertyValue('--color-primary').trim(),
    );
  expect(await excalidrawPrimary()).toBe(accentPalette.sky.modes.light.strong);

  await pickAccent(application.page, 'Lilac');

  await expect.poll(excalidrawPrimary).toBe(accentPalette.lilac.modes.light.strong);
  await diagram.ready();
});

test('Ctrl+\\ collapses the sidebar, and it stays collapsed after restart', async ({
  application,
}) => {
  await startWorkspace(application);
  const sidebarElement = () => application.page.getByRole('complementary', { name: 'Sidebar' });

  await application.page.keyboard.press('Control+Backslash');

  await expect(sidebarElement()).toHaveAttribute('data-collapsed', 'true');
  await expect(sidebarElement().getByRole('button', { name: 'Expand sidebar' })).toBeVisible();
  await expect.poll(async () => (await savedSettings(application)).sidebarCollapsed).toBe(true);

  await application.restart();
  await expect(sidebarElement()).toHaveAttribute('data-collapsed', 'true');
  await expect(
    sidebarElement().getByRole('button', { name: 'Quick note', exact: true }),
  ).toBeVisible();
});

test('Ctrl+\\ does nothing while typing in a diagram text element', async ({ application }) => {
  await startWorkspace(application);
  const diagram = new Diagram(application.page);
  await diagram.create();

  await diagram.startText('Notes');
  await application.page.keyboard.press('Control+Backslash');
  await application.page.keyboard.press('Escape');

  await expect(application.page.getByRole('complementary', { name: 'Sidebar' })).toHaveAttribute(
    'data-collapsed',
    'false',
  );
  await diagram.expectElementCount(1);
});
