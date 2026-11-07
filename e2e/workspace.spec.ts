import { readdir } from 'node:fs/promises';
import { test, expect } from './fixtures';
import { Sidebar } from './pages/sidebar';
import { Editor } from './pages/editor';
import { Onboarding } from './pages/onboarding';
import { SearchPalette } from './pages/search-palette';
import { Settings } from './pages/settings';

test('onboarding can be completed with a name', async ({ application }) => {
  await application.start();
  await new Onboarding(application.page).finish('QA');
  await new Sidebar(application.page).ready();
  expect(await application.settings()).toMatchObject({
    onboardingCompleted: true,
    userName: 'QA',
    vaultPath: application.vault,
  });
  expect(await application.note('Getting started/Welcome.md')).toContain('# Welcome');
});

test('onboarding can be skipped using isolated defaults', async ({ application }) => {
  await application.start();
  await new Onboarding(application.page).skip();
  await new Sidebar(application.page).ready();
  expect(await application.settings()).toMatchObject({
    onboardingCompleted: true,
    userName: '',
    vaultPath: application.vault,
  });
});

test('creates, autosaves, renames, and trashes notes and folders on disk', async ({
  application,
}) => {
  await application.seedSettings();
  await application.start();
  const sidebar = new Sidebar(application.page);
  const editor = new Editor(application.page);
  await sidebar.ready();
  await sidebar.createFolder('Work');
  await sidebar.createNote();
  await editor.name('A thought');
  await editor.fill('A thought saved to the real filesystem.');
  await expect
    .poll(() => application.note('Work/A thought.md'))
    .toBe('A thought saved to the real filesystem.');
  await editor.home();
  await sidebar.rename('note', 'A thought', 'Renamed thought');
  expect(await application.note('Work/Renamed thought.md')).toContain('real filesystem');
  await sidebar.rename('folder', 'Work', 'Projects');
  expect(await application.note('Projects/Renamed thought.md')).toContain('real filesystem');
  await sidebar.delete('note', 'Renamed thought');
  await sidebar.delete('folder', 'Projects');
  const trashed = await readdir(`${application.vault}/.trash`, { recursive: true });
  expect(trashed.some((path) => path.endsWith('Renamed thought.md'))).toBe(true);
  expect(trashed.some((path) => path.endsWith('Projects'))).toBe(true);
});

test('rich text formatting survives a reload', async ({ application }) => {
  await application.seedSettings();
  await application.start();
  await new Sidebar(application.page).createNote();
  let editor = new Editor(application.page);
  await editor.name('Formatted');
  await editor.bold('Bold thought');
  await expect.poll(() => application.note('Formatted.md')).toContain('**Bold thought**');
  await application.page.reload();
  editor = new Editor(application.page);
  await expect(editor.title).toHaveValue('Formatted');
  await editor.expectBold('Bold thought');
});

test('/page links open their target, show backlinks, and are rewritten after renaming', async ({
  application,
}) => {
  await application.seedSettings();
  await application.start();
  const sidebar = new Sidebar(application.page);
  const editor = new Editor(application.page);
  await sidebar.createNote();
  await editor.name('Target');
  await editor.fill('A linked target');
  await editor.home();
  await sidebar.createNote();
  await editor.name('Source');
  await editor.fill('Connected thoughts');
  await editor.insertPageLink('Target');
  await expect.poll(() => application.note('Source.md')).toContain('Target.md');
  await editor.openLink('Target');
  await expect(editor.title).toHaveValue('Target');
  await editor.expectBacklink('Source');
  await editor.name('New target');
  await expect.poll(() => application.note('Source.md')).toContain('New%20target.md');
  await editor.expectBacklink('Source');
});

test('search finds a Sinhala query', async ({ application }) => {
  await application.seedSettings();
  await application.start();
  await new Sidebar(application.page).createNote();
  const editor = new Editor(application.page);
  await editor.name('සිංහල සටහන');
  await editor.fill('අද මගේ අලුත් අදහස සටහන් කරමි');
  await editor.saved();
  const search = new SearchPalette(application.page);
  await search.open();
  await search.query('අදහස');
  await search.expectResult('සිංහල සටහන');
  await search.choose('සිංහල සටහන');
  await expect(editor.title).toHaveValue('සිංහල සටහන');
});

test('theme persists across a process restart', async ({ application }) => {
  await application.seedSettings();
  await application.start();
  let settings = new Settings(application.page);
  await settings.open();
  await settings.theme('dark');
  await expect.poll(() => application.settings()).toMatchObject({ theme: 'dark' });
  await settings.close();
  await application.restart();
  settings = new Settings(application.page);
  await new Sidebar(application.page).ready();
  await settings.expectTheme('dark');
});

test('closing immediately flushes the latest text', async ({ application }) => {
  await application.seedSettings();
  await application.start();
  await new Sidebar(application.page).createNote();
  const editor = new Editor(application.page);
  await editor.name('Close save');
  await editor.fill('Text entered immediately before closing.');
  await editor.closeWindow();
  await application.waitForExit();
  expect(await application.note('Close save.md')).toBe('Text entered immediately before closing.');
  await application.restart();
  await expect(new Editor(application.page).content).toContainText(
    'Text entered immediately before closing.',
  );
});
