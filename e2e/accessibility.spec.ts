import AxeBuilder from '@axe-core/playwright';
import { test, expect } from './fixtures';
import { Sidebar } from './pages/sidebar';
import { Editor } from './pages/editor';
import { Settings } from './pages/settings';
import { SearchPalette } from './pages/search-palette';

for (const theme of ['light', 'dark'] as const) {
  test(`home, editor, search, and settings are accessible in ${theme} theme`, async ({
    application,
  }, testInfo) => {
    await application.seedSettings({ theme });
    await application.start();
    const sidebar = new Sidebar(application.page);
    await sidebar.ready();
    const check = async (screen: string) => {
      const results = await new AxeBuilder({ page: application.page }).analyze();
      await testInfo.attach(`axe-${theme}-${screen}`, {
        body: JSON.stringify(results.violations, null, 2),
        contentType: 'application/json',
      });
      expect(
        results.violations.filter((violation) =>
          ['serious', 'critical'].includes(violation.impact ?? ''),
        ),
        screen,
      ).toEqual([]);
    };
    await check('home');
    await sidebar.createNote();
    const editor = new Editor(application.page);
    await editor.fill('An accessible note');
    await check('editor');
    const search = new SearchPalette(application.page);
    await search.open();
    await search.query('accessible');
    await check('search');
    await search.close();
    const settings = new Settings(application.page);
    await settings.open();
    await check('settings');
  });
}
