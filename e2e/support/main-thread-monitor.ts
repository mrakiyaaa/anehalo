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

/**
 * The longest main-thread task between two performance marks the app set, read from the
 * browser's buffered long-task entries, so tasks before the measuring started still count.
 */
export async function longestTaskBetweenMarks(
  page: Page,
  startMark: string,
  endMark: string,
): Promise<number> {
  return page.evaluate(
    async ([start, end]) => {
      const [startEntry] = performance.getEntriesByName(start, 'mark');
      const [endEntry] = performance.getEntriesByName(end, 'mark');
      if (!startEntry || !endEntry) throw new Error(`Missing performance mark ${start} or ${end}.`);
      const tasks = await new Promise<PerformanceEntry[]>((resolve) => {
        const collected: PerformanceEntry[] = [];
        const observer = new PerformanceObserver((list) => collected.push(...list.getEntries()));
        observer.observe({ type: 'longtask', buffered: true });
        // With no long tasks the callback never runs; whatever is still queued is taken here.
        requestAnimationFrame(() => {
          collected.push(...observer.takeRecords());
          observer.disconnect();
          resolve(collected);
        });
      });
      return tasks
        .filter(
          (task) =>
            task.startTime + task.duration >= startEntry.startTime &&
            task.startTime <= endEntry.startTime,
        )
        .reduce((longest, task) => Math.max(longest, task.duration), 0);
    },
    [startMark, endMark] as const,
  );
}
