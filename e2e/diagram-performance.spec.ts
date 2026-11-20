import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test, expect } from './fixtures';
import { Sidebar } from './pages/sidebar';
import { Diagram } from './pages/diagram';
import { largeDiagram } from './support/diagram-files';
import { longestMainThreadTask, startMainThreadMonitor } from './support/main-thread-monitor';

const heavyDiagram = 'Heavy.excalidraw';
const longestAllowedTaskMilliseconds = 100;

test('saving 5,000 elements and five 2 MB images keeps every frame under 100 ms', async ({
  application,
}, testInfo) => {
  test.setTimeout(240_000);
  await application.seedSettings();
  const content = largeDiagram();
  await writeFile(join(application.vault, heavyDiagram), content);
  await application.start();
  const sidebar = new Sidebar(application.page);
  await sidebar.ready();
  const diagram = new Diagram(application.page);
  await sidebar.open('Heavy');
  await diagram.expectElementCount(5005, 120_000);
  await diagram.saved();

  await diagram.drawRectangle();
  await expect(diagram.screen.getByRole('status').filter({ hasText: 'Saving...' })).toBeVisible();
  // Drawing redraws 5,000 shapes; measuring starts after that, so it covers only the save.
  await application.page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  await startMainThreadMonitor(application.page);
  await expect(
    diagram.screen.getByRole('status').filter({ hasText: 'Saved just now' }),
  ).toBeVisible({ timeout: 120_000 });

  const longestTaskMilliseconds = await longestMainThreadTask(application.page);
  const saveMilliseconds = await application.page.evaluate(
    () => performance.getEntriesByName('anehalo:diagram-save').at(-1)?.duration ?? null,
  );
  const report = {
    fileMegabytes: Buffer.byteLength(content) / 1024 / 1024,
    longestTaskMilliseconds,
    saveMilliseconds,
  };
  await testInfo.attach('diagram-save-performance', {
    body: JSON.stringify(report, null, 2),
    contentType: 'application/json',
  });
  console.log(`Diagram save performance: ${JSON.stringify(report)}`);
  expect(saveMilliseconds).not.toBeNull();
  expect(longestTaskMilliseconds).toBeLessThan(longestAllowedTaskMilliseconds);
});
