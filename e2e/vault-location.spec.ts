import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { test, expect } from './fixtures';
import { Onboarding } from './pages/onboarding';
import { Sidebar } from './pages/sidebar';
import { VaultRecovery } from './pages/vault-recovery';
import { Settings } from './pages/settings';
import { Editor } from './pages/editor';

test('the native picker creates only an Anehalo child, denies the parent scope, and restores that scope after restart', async ({
  application,
}) => {
  await application.seedSettings({ onboardingCompleted: false });
  const location = join(application.root, 'My notes');
  await mkdir(join(location, 'Other files'), { recursive: true });
  await writeFile(join(location, 'Other files', 'Private.md'), 'This is not a vault note.');
  await application.start();
  const onboarding = new Onboarding(application.page);
  await onboarding.chooseLocation(location, application.processIdentifier);
  const vault = join(location, 'Anehalo');
  await onboarding.expectFinalPath(vault);
  await onboarding.finishLocation();
  await new Sidebar(application.page).ready();
  expect(await application.directoryAllowed(location)).toBe(false);
  expect(await application.directoryAllowed(vault)).toBe(true);
  expect(await readFile(join(vault, 'Getting started', 'Welcome.md'), 'utf8')).toContain(
    'Welcome to Anehalo',
  );
  expect(await readFile(join(location, 'Other files', 'Private.md'), 'utf8')).toBe(
    'This is not a vault note.',
  );
  await application.restart();
  await new Sidebar(application.page).ready();
  expect(await application.directoryAllowed(location)).toBe(false);
  expect(await application.directoryAllowed(vault)).toBe(true);
});

test('an invalid saved parent opens recovery without scanning its files', async ({
  application,
}) => {
  const oldParent = join(application.root, 'Old location');
  await mkdir(oldParent);
  await writeFile(join(oldParent, 'Private.md'), 'Keep this outside the vault.');
  await application.seedSettings({ vaultPath: oldParent });
  await application.start();
  const recovery = new VaultRecovery(application.page);
  await recovery.ready();
  await recovery.useDefault();
  await new Sidebar(application.page).ready();
  expect(await readFile(join(oldParent, 'Private.md'), 'utf8')).toBe(
    'Keep this outside the vault.',
  );
  await application.restart();
  await new Sidebar(application.page).ready();
});

test('Settings reuses a copied Anehalo folder in any case without nesting another vault', async ({
  application,
}) => {
  await application.seedSettings();
  const vault = join(application.root, 'Restored notes', 'aNeHaLo');
  await mkdir(vault, { recursive: true });
  await writeFile(join(vault, 'Restored.md'), 'Keep the copied note intact.');
  await application.start();
  await new Sidebar(application.page).ready();
  const settings = new Settings(application.page);
  await settings.open();
  await settings.chooseVault(vault, application.processIdentifier);
  await settings.confirmVault(vault);
  await new Sidebar(application.page).openNote('Restored');
  await new Editor(application.page).ready('Restored');
  expect((await readdir(vault)).some((name) => name.toLowerCase() === 'anehalo')).toBe(false);
  expect(await readFile(join(vault, 'Restored.md'), 'utf8')).toBe('Keep the copied note intact.');
  expect(await application.directoryAllowed(join(application.root, 'Restored notes'))).toBe(false);
  await application.restart();
  await new Editor(application.page).ready('Restored');
});
