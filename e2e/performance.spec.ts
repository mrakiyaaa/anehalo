import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test, expect } from './fixtures';
import { Sidebar } from './pages/sidebar';
import { SearchPalette } from './pages/search-palette';

test('a generated 2,000-note vault meets startup and search budgets', async ({
  application,
}, testInfo) => {
  test.setTimeout(120_000);
  await application.seedSettings({ reopenLastNote: false });
  await mkdir(join(application.vault, 'Generated'));
  await Promise.all(
    Array.from({ length: 2000 }, (_, index) =>
      writeFile(
        join(application.vault, 'Generated', `Note ${index.toString().padStart(4, '0')}.md`),
        `# Note ${index}\n\nA generated thought about gardens and සිංහල. ${index === 1999 ? 'unique-needle' : 'ordinary'}\n${'Sample content for a realistic small note. '.repeat(30)}`,
      ),
    ),
  );
  const started = performance.now();
  await application.start();
  await new Sidebar(application.page).ready(60_000);
  const observedStartupMilliseconds = performance.now() - started;
  const startupMilliseconds = await application.usableMilliseconds();
  const search = new SearchPalette(application.page);
  await search.open();
  await search.query('unique-needle');
  await search.expectResult('Note 1999');
  const samples: number[] = [];
  for (let index = 0; index < 5; index++) {
    await search.query(`missing-${index}`);
    const latency = await search.measureQuery('unique-needle');
    await search.expectResult('Note 1999');
    samples.push(latency);
  }
  const session = await application.page.context().newCDPSession(application.page);
  const heap = await session.send('Runtime.getHeapUsage');
  const metrics = {
    notes: 2000,
    startupMilliseconds,
    observedStartupMilliseconds,
    searchMilliseconds: samples,
    javascriptHeapMegabytes: heap.usedSize / 1024 / 1024,
    nativeProcesses: await application.memory(),
    startupProfile: await application.startupProfile(),
  };
  const metricsPath = testInfo.outputPath('performance.json');
  await writeFile(metricsPath, JSON.stringify(metrics, null, 2));
  await testInfo.attach('performance', { path: metricsPath, contentType: 'application/json' });
  expect(startupMilliseconds).toBeLessThan(2000);
  expect(Math.max(...samples)).toBeLessThan(100);
});
