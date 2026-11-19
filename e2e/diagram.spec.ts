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
