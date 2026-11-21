import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test, expect } from './fixtures';
import { Sidebar } from './pages/sidebar';
import { SearchPalette } from './pages/search-palette';
import { selectedE2eBuild } from './support/e2e-build';
import { textDiagram } from './support/diagram-files';
import { longestTaskBetweenMarks } from './support/main-thread-monitor';
import { startupMarks } from '../src/features/diagnostics/startup-marks';
import { startupBudgets } from './support/startup-budgets';
import { startupProfileAttachment } from './support/startup-profile-reporter';
import {
  appMilliseconds,
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
  // Diagrams with text, as search indexes it after first paint; it must not slow startup down.
  await mkdir(join(application.vault, 'Diagrams'));
  await Promise.all(
    Array.from({ length: diagramCount }, (_, index) =>
      writeFile(
        join(
          application.vault,
          'Diagrams',
          `Diagram ${index.toString().padStart(3, '0')}.excalidraw`,
        ),
        textDiagram(
          [
            { id: 'title', text: `Release flow ${index}` },
            {
              id: 'label',
              text: index === diagramCount - 1 ? 'diagram-needle checkout' : 'Payment step',
              inBox: 'box',
            },
          ],
          20,
        ),
      ),
    ),
  );

  async function launch(): Promise<StartupTimestamps> {
    await application.start();
    await new Sidebar(application.page).ready(60_000);
    return application.startupTimestamps();
  }
  // The first start after installing also creates the WebView2 profile; it is reported only.
  await application.resetWebviewProfile();
  const firstLaunch = await launch();
  const launches: StartupTimestamps[] = [];
  for (let index = 0; index < budget.warmLaunches; index++) {
    await application.stop();
    launches.push(await launch());
  }
  const startupSamples = launches.map(startupMilliseconds);
  const medianStartupMilliseconds = median(startupSamples);
  const appSamples = [firstLaunch, ...launches].map(appMilliseconds);
  const medianAppMilliseconds = median(appSamples);

  // The last launch's index build, which reads and indexes every note and diagram.
  await expect
    .poll(async () => (await application.pageMarkTimes())[startupMarks.searchIndexFinished], {
      timeout: 60_000,
    })
    .toBeDefined();
  const longestIndexTaskMilliseconds = await longestTaskBetweenMarks(
    application.page,
    startupMarks.searchIndexStarted,
    startupMarks.searchIndexFinished,
  );

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
  const diagramSearchSamples: number[] = [];
  for (let index = 0; index < 5; index++) {
    await search.query(`missing-${index}`);
    const latency = await search.measureQuery('diagram-needle');
    await search.expectResult('Diagram 499');
    diagramSearchSamples.push(latency);
  }
  const session = await application.page.context().newCDPSession(application.page);
  const heap = await session.send('Runtime.getHeapUsage');
  const profile = {
    build,
    notes: noteCount,
    diagrams: diagramCount,
    budget,
    medianStartupMilliseconds,
    startupSamples,
    medianAppMilliseconds,
    appSamples,
    firstLaunch: { timestamps: firstLaunch, stages: measureStages(firstLaunch) },
    medianStages: medianStages(launches),
    launches: launches.map((timestamps) => ({ timestamps, stages: measureStages(timestamps) })),
    searchMilliseconds: searchSamples,
    diagramSearchMilliseconds: diagramSearchSamples,
    longestIndexTaskMilliseconds,
    javascriptHeapMegabytes: heap.usedSize / 1024 / 1024,
    nativeProcesses: await application.memory(),
  };
  const profilePath = testInfo.outputPath('startup-profile.json');
  await writeFile(profilePath, JSON.stringify(profile, null, 2));
  await testInfo.attach(startupProfileAttachment, {
    path: profilePath,
    contentType: 'application/json',
  });

  expect(medianAppMilliseconds, `app time, median of ${appSamples.join(', ')} ms`).toBeLessThan(
    budget.appMedianMilliseconds,
  );
  expect(
    medianStartupMilliseconds,
    `normal start, median of ${startupSamples.join(', ')} ms`,
  ).toBeLessThan(budget.warmMedianMilliseconds);
  expect(Math.max(...searchSamples)).toBeLessThan(100);
  expect(Math.max(...diagramSearchSamples)).toBeLessThan(100);
  expect(longestIndexTaskMilliseconds, 'longest task while indexing').toBeLessThan(100);
});
