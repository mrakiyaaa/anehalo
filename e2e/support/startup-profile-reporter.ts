import { appendFileSync, readFileSync } from 'node:fs';
import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import { selectedE2eBuild } from './e2e-build';
import {
  formatStartupTable,
  medianStages,
  parseNativeTimeline,
  type StartupTimestamps,
} from './startup-profile';

export const startupProfileAttachment = 'startup-profile';

function parseLaunch(value: unknown): StartupTimestamps {
  if (typeof value !== 'object' || value === null) throw new Error('A launch record is missing.');
  const launch = value as Record<string, unknown>;
  const timestamps = launch.timestamps as Record<string, unknown> | undefined;
  if (typeof timestamps?.spawned !== 'number' || typeof timestamps.marks !== 'object')
    throw new Error('A launch record has no timestamps.');
  return {
    spawned: timestamps.spawned,
    ...parseNativeTimeline(timestamps),
    marks: timestamps.marks as StartupTimestamps['marks'],
  };
}

/**
 * Prints the per-stage startup medians of every measured launch in this run, and adds them to
 * the GitHub job summary, so CI timings can be read without downloading artifacts.
 */
export default class StartupProfileReporter implements Reporter {
  private readonly launches: StartupTimestamps[] = [];

  onTestEnd(_test: TestCase, result: TestResult) {
    for (const attachment of result.attachments) {
      if (attachment.name !== startupProfileAttachment || !attachment.path) continue;
      const profile = JSON.parse(readFileSync(attachment.path, 'utf8')) as { launches?: unknown };
      if (!Array.isArray(profile.launches))
        throw new Error(`${attachment.path} has no launch records.`);
      this.launches.push(...profile.launches.map(parseLaunch));
    }
  }

  onEnd() {
    if (this.launches.length === 0) return;
    const title = `Startup profile, ${selectedE2eBuild()} build`;
    const table = formatStartupTable(title, this.launches);
    console.log(`\n${table}\n`);
    const summary = process.env.GITHUB_STEP_SUMMARY;
    if (summary) appendFileSync(summary, `${table}\n\n`);
    // Annotations, unlike the job summary, can be read through the public API.
    if (process.env.GITHUB_ACTIONS) {
      const stages = medianStages(this.launches)
        .map(
          ({ stage, milliseconds }) =>
            `${stage}: ${milliseconds === null ? 'n/a' : Math.round(milliseconds)}`,
        )
        .join('; ');
      console.log(`::notice title=${title} (${this.launches.length} launches)::${stages}`);
    }
  }

  printsToStdio() {
    return false;
  }
}
