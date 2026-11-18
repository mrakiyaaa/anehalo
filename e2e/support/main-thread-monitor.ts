import type { Page } from '@playwright/test';

interface MonitoredWindow {
  anehaloLongestTaskMilliseconds: number;
}

/** Records the longest main-thread task, which is what a user perceives as a frozen window. */
export async function startMainThreadMonitor(page: Page): Promise<void> {
  await page.evaluate(() => {
    const monitored = window as unknown as MonitoredWindow;
    monitored.anehaloLongestTaskMilliseconds = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries())
        monitored.anehaloLongestTaskMilliseconds = Math.max(
          monitored.anehaloLongestTaskMilliseconds,
          entry.duration,
        );
    }).observe({ type: 'longtask' });
  });
}

export async function longestMainThreadTask(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as MonitoredWindow).anehaloLongestTaskMilliseconds);
}
