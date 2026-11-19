import { test, expect } from './fixtures';
import { Sidebar } from './pages/sidebar';
import { Diagram } from './pages/diagram';

// Everything the app loads must come from the app itself: its bundle, its IPC bridge, or the
// asset protocol for local files.
const localOrigins = new Set([
  'http://tauri.localhost',
  'http://ipc.localhost',
  'http://asset.localhost',
]);

function isLocal(url: string) {
  if (url.startsWith('data:') || url.startsWith('blob:')) return true;
  return localOrigins.has(new URL(url).origin);
}

test('the diagram editor runs offline with bundled fonts and no network features', async ({
  application,
}) => {
  test.setTimeout(90_000);
  await application.seedSettings();
  await application.start();
  const requests: string[] = [];
  application.page.on('request', (request) => requests.push(request.url()));
  await new Sidebar(application.page).ready();
  const diagram = new Diagram(application.page);

  await diagram.open();
  await diagram.drawRectangle();
  await diagram.writeText('Offline');

  await expect
    .poll(() =>
      application.page.evaluate(() =>
        performance
          .getEntriesByType('resource')
          .some((entry) => entry.name.includes('/excalidraw/fonts/Excalifont/')),
      ),
    )
    .toBe(true);
  await expect(diagram.container.locator('a[href^="http"]')).toHaveCount(0);

  const menu = await diagram.openMainMenu();
  await expect(menu).toContainText('Dark mode');
  await expect(menu).toContainText('Reset the canvas');
  await expect(menu).toContainText('Help');
  for (const networkItem of ['Live collaboration', 'Excalidraw+', 'GitHub', 'Discord', 'Sign up'])
    await expect(menu).not.toContainText(networkItem);
  await expect(diagram.container.locator('a[href^="http"]')).toHaveCount(0);
  await diagram.closeMenus();

  const moreTools = await diagram.openMoreTools();
  await expect(moreTools).toContainText('Laser pointer');
  for (const hiddenItem of [
    'Generate',
    'Text to diagram',
    'Wireframe to code',
    'Mermaid',
    'Web Embed',
  ])
    await expect(moreTools.getByText(hiddenItem)).toBeHidden();
  await diagram.closeMenus();

  await diagram.openLibrary();
  await expect(diagram.container.locator('.library-menu-browse-button')).toBeHidden();

  expect(requests.filter((url) => !isLocal(url))).toEqual([]);
  expect(requests.filter((url) => /mermaid/i.test(url))).toEqual([]);
});

test('the diagram editor follows the Anehalo theme switch both ways', async ({ application }) => {
  await application.seedSettings();
  await application.start();
  await new Sidebar(application.page).ready();
  const diagram = new Diagram(application.page);
  await diagram.open();
  const themeSwitch = application.page.getByRole('switch', { name: 'Dark mode' });

  await expect(diagram.container).not.toHaveClass(/theme--dark/);
  await themeSwitch.click();
  await expect(diagram.container).toHaveClass(/theme--dark/);
  await themeSwitch.click();
  await expect(diagram.container).not.toHaveClass(/theme--dark/);
});

// "i" (image) is left out: it opens the native file picker.
const toolShortcuts = ['v', 'r', 'd', 'o', 'a', 'l', 'p', 't', 'e', 'h', 'k', 'f', 'x'];
const numberShortcuts = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

test('Mermaid never loads, from shortcuts, menus or pasted Mermaid text', async ({
  application,
}) => {
  test.setTimeout(90_000);
  await application.seedSettings();
  await application.start();
  const requests: string[] = [];
  application.page.on('request', (request) => requests.push(request.url()));
  await new Sidebar(application.page).ready();
  const diagram = new Diagram(application.page);
  await diagram.open();
  await diagram.drawRectangle();
  await diagram.expectElementCount(1);

  for (const key of [...toolShortcuts, ...numberShortcuts, 'Alt+Shift+D', 'Control+/']) {
    await application.page.keyboard.press(key);
    await application.page.keyboard.press('Escape');
  }
  await (await diagram.openMoreTools()).waitFor();
  await diagram.closeMenus();
  await (await diagram.openMainMenu()).waitFor();
  await diagram.closeMenus();

  // Excalidraw tries Mermaid on pasted text that looks like it; the stub makes it plain text.
  await diagram.focusCanvas();
  await application.page.evaluate(() => {
    const clipboard = new DataTransfer();
    clipboard.setData('text/plain', 'flowchart TD\n  Start --> Stop');
    (document.activeElement ?? document).dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: clipboard, bubbles: true }),
    );
  });
  await expect.poll(() => diagram.elementCount()).toBeGreaterThan(1);

  expect(requests.some((url) => url.includes('text-to-diagram-unavailable'))).toBe(true);
  expect(requests.filter((url) => /mermaid|katex|cytoscape/i.test(url))).toEqual([]);
});
