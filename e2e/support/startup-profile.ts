import { startupMarks, type StartupMark } from '../../src/features/diagnostics/startup-marks';

/** Unix-millisecond times of one launch, from the harness, the native app, and the page. */
export interface StartupTimestamps {
  readonly spawned: number;
  readonly processEntered: number | null;
  readonly pluginsInitialized: number | null;
  readonly setupStarted: number | null;
  readonly setupCompleted: number | null;
  readonly pageLoadStarted: number | null;
  readonly marks: Readonly<Partial<Record<StartupMark, number>>>;
}

type NativePoint =
  'processEntered' | 'pluginsInitialized' | 'setupStarted' | 'setupCompleted' | 'pageLoadStarted';
type NativeTimeline = Pick<StartupTimestamps, NativePoint>;

function optionalTime(value: unknown, field: string): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  throw new Error(`The native startup timeline has an invalid ${field}.`);
}

/** Validates the reply of the app's startup_timeline command. */
export function parseNativeTimeline(value: unknown): NativeTimeline {
  if (typeof value !== 'object' || value === null)
    throw new Error('The native startup timeline is missing.');
  const timeline = value as Record<string, unknown>;
  return {
    processEntered: optionalTime(timeline.processEntered, 'processEntered'),
    pluginsInitialized: optionalTime(timeline.pluginsInitialized, 'pluginsInitialized'),
    setupStarted: optionalTime(timeline.setupStarted, 'setupStarted'),
    setupCompleted: optionalTime(timeline.setupCompleted, 'setupCompleted'),
    pageLoadStarted: optionalTime(timeline.pageLoadStarted, 'pageLoadStarted'),
  };
}

type StartupPoint = 'spawned' | NativePoint | StartupMark;

interface StartupStage {
  readonly name: string;
  readonly from: StartupPoint;
  readonly to: StartupPoint;
}

/** The search index finishes after Home is usable, so it is listed but not part of the total. */
export const startupStages: readonly StartupStage[] = [
  { name: 'Process spawn to native entry', from: 'spawned', to: 'processEntered' },
  { name: 'Plugin initialization', from: 'processEntered', to: 'pluginsInitialized' },
  {
    name: 'Event loop, window and WebView2 creation',
    from: 'pluginsInitialized',
    to: 'setupStarted',
  },
  { name: 'App setup hook (paths, tray)', from: 'setupStarted', to: 'setupCompleted' },
  { name: 'Setup to page navigation', from: 'setupCompleted', to: 'pageLoadStarted' },
  {
    name: 'Page load to app script running',
    from: 'pageLoadStarted',
    to: startupMarks.scriptStarted,
  },
  {
    name: 'Script to window shown',
    from: startupMarks.scriptStarted,
    to: startupMarks.windowShown,
  },
  {
    name: 'Vault scan (titles and metadata)',
    from: startupMarks.vaultReadStarted,
    to: startupMarks.vaultReadFinished,
  },
  {
    name: 'Scan to first Home render',
    from: startupMarks.vaultReadFinished,
    to: startupMarks.usable,
  },
  {
    name: 'Search index build (background)',
    from: startupMarks.searchIndexStarted,
    to: startupMarks.searchIndexFinished,
  },
  { name: 'Total: spawn to Home usable', from: 'spawned', to: startupMarks.usable },
];

export interface StageDuration {
  readonly stage: string;
  readonly milliseconds: number | null;
}

function pointTime(timestamps: StartupTimestamps, point: StartupPoint): number | null {
  switch (point) {
    case 'spawned':
    case 'processEntered':
    case 'pluginsInitialized':
    case 'setupStarted':
    case 'setupCompleted':
    case 'pageLoadStarted':
      return timestamps[point];
    default:
      return timestamps.marks[point] ?? null;
  }
}

export function measureStages(timestamps: StartupTimestamps): StageDuration[] {
  return startupStages.map(({ name, from, to }) => {
    const start = pointTime(timestamps, from);
    const end = pointTime(timestamps, to);
    return { stage: name, milliseconds: start === null || end === null ? null : end - start };
  });
}

export function startupMilliseconds(timestamps: StartupTimestamps): number {
  const usable = timestamps.marks[startupMarks.usable];
  if (usable === undefined) throw new Error('The launch never reached a usable Home screen.');
  return usable - timestamps.spawned;
}

/**
 * Anehalo's own share of a start: from the moment the page starts loading to a usable Home.
 * Everything before that is the WebView2 browser starting up, which the app does not control.
 */
export function appMilliseconds(timestamps: StartupTimestamps): number {
  const usable = timestamps.marks[startupMarks.usable];
  if (usable === undefined || timestamps.pageLoadStarted === null)
    throw new Error('The launch has no page-load or usable-Home time.');
  return usable - timestamps.pageLoadStarted;
}

export function median(values: readonly number[]): number {
  if (values.length === 0) throw new Error('A median needs at least one value.');
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const upper = sorted[middle];
  const lower = sorted[middle - 1];
  if (upper === undefined) throw new Error('A median needs at least one value.');
  return sorted.length % 2 === 1 || lower === undefined ? upper : (lower + upper) / 2;
}

export function formatStartupTable(title: string, launches: readonly StartupTimestamps[]): string {
  const rows = medianStages(launches).map(
    ({ stage, milliseconds }) =>
      `| ${stage} | ${milliseconds === null ? 'n/a' : Math.round(milliseconds)} |`,
  );
  return [
    `### ${title} (median of ${launches.length} launches)`,
    '',
    '| Stage | Median ms |',
    '| --- | ---: |',
    ...rows,
  ].join('\n');
}

/** Median per stage across launches; a stage missing from every launch stays null. */
export function medianStages(launches: readonly StartupTimestamps[]): StageDuration[] {
  const measured = launches.map(measureStages);
  return startupStages.map(({ name }, index) => {
    const values = measured
      .map((stages) => stages[index]?.milliseconds)
      .filter((value): value is number => typeof value === 'number');
    return { stage: name, milliseconds: values.length > 0 ? median(values) : null };
  });
}
