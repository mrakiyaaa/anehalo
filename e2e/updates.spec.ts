import { readFile } from 'node:fs/promises';
import { test, expect } from './fixtures';
import { Settings } from './pages/settings';
import { Sidebar } from './pages/sidebar';

test('Settings shows the app version, and an isolated run never checks for updates', async ({
  application,
}) => {
  // The version in Settings must come from the running app, so compare with the real config.
  const configuration = JSON.parse(await readFile('src-tauri/tauri.conf.json', 'utf8')) as {
    version: string;
  };
  await application.seedSettings();
  await application.start();
  await new Sidebar(application.page).ready();
  await new Settings(application.page).open();

  const dialog = application.page.getByRole('dialog', { name: 'Settings', exact: true });
  await expect(dialog.getByText(`Version ${configuration.version}`, { exact: true })).toBeVisible();
  // Test runs use an isolated root, where updates are off, as they are in development builds.
  await expect(dialog.getByText('Updates are turned off in development builds.')).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: 'Check for updates', exact: true }),
  ).toBeDisabled();

  const toggle = dialog.getByRole('checkbox', {
    name: 'Automatically check for updates',
    exact: true,
  });
  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  await expect
    .poll(
      async () =>
        ((await application.settings()) as { autoCheckForUpdates?: boolean }).autoCheckForUpdates,
    )
    .toBe(false);
  await expect(application.page.getByText(/is available/)).toHaveCount(0);
});
