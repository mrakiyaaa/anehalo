import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test, expect } from './fixtures';
import { Sidebar } from './pages/sidebar';
import { SearchPalette } from './pages/search-palette';
import { selectedE2eBuild } from './support/e2e-build';
import { smallDiagram } from './support/diagram-files';
import { startupBudgets } from './support/startup-budgets';
import { startupProfileAttachment } from './support/startup-profile-reporter';
import {
  measureStages,
  median,
  medianStages,
  startupMilliseconds,
  type StartupTimestamps,
} from './support/startup-profile';

const noteCount = 2_000;
const diagramCount = 500;

test('a generated vault of 2,000 notes and 500 diagrams meets startup and search budgets @startup-budget', async ({
  application,
}, testInfo) => {
  test.setTimeout(240_000);
  const build = selectedE2eBuild();
  const budget = startupBudgets[build];
  await application.seedSettings({ reopenLastNote: false });
  await mkdir(join(application.vault, 'Generated'));
  await Promise.all(
    Array.from({ length: noteCount }, (_, index) =>
      writeFile(
        join(application.vault, 'Generated', `Note ${index.toString().padStart(4, '0')}.md`),
        `# Note ${index}\n\nA generated thought about gardens and සිංහල. ${index === noteCount - 1 ? 'unique-needle' : 'ordinary'}\n${'Sample content for a realistic small note. '.repeat(30)}`,
      ),
    ),
  );
  // Diagrams are listed by name only, so they must not slow startup down.
  await mkdir(join(application.vault, 'Diagrams'));
  await Promise.all(
    Array.from({ length: diagramCount }, (_, index) =>
      writeFile(
        join(
          application.vault,
          'Diagrams',
          `Diagram ${index.toString().padStart(3, '0')}.excalidraw`,
        ),
        smallDiagram(),
      ),
    ),
  );

  const launches: StartupTimestamps[] = [];
  for (let launch = 0; launch < budget.launches; launch++) {
    if (launch > 0) await application.stop();
    await application.resetWebviewProfile();
    await application.start();
    await new Sidebar(application.page).ready(60_000);
    launches.push(await application.startupTimestamps());
  }
  const startupSamples = launches.map(startupMilliseconds);
  const medianStartupMilliseconds = median(startupSamples);

  const search = new SearchPalette(application.page);
  await search.open();
  await search.query('unique-needle');
  await search.expectResult('Note 1999');
  const searchSamples: number[] = [];
  for (let index = 0; index < 5; index++) {
    await search.query(`missing-${index}`);
    const latency = await search.measureQuery('unique-needle');
    await search.expectResult('Note 1999');
    searchSamples.push(latency);
  }
  const session = await application.page.context().newCDPSession(application.page);
  const heap = await session.send('Runtime.getHeapUsage');
  const profile = {
    build,
    notes: noteCount,
    diagrams: diagramCount,
    budgetMilliseconds: budget.medianMilliseconds,
    medianStartupMilliseconds,
    startupSamples,
    medianStages: medianStages(launches),
    launches: launches.map((timestamps) => ({ timestamps, stages: measureStages(timestamps) })),
    searchMilliseconds: searchSamples,
    javascriptHeapMegabytes: heap.usedSize / 1024 / 1024,
    nativeProcesses: await application.memory(),
  };
  const profilePath = testInfo.outputPath('startup-profile.json');
  await writeFile(profilePath, JSON.stringify(profile, null, 2));
  await testInfo.attach(startupProfileAttachment, {
    path: profilePath,
    contentType: 'application/json',
  });

  expect(medianStartupMilliseconds, `median of ${startupSamples.join(', ')} ms`).toBeLessThan(
    budget.medianMilliseconds,
  );
  expect(Math.max(...searchSamples)).toBeLessThan(100);
});
