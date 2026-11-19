import { describe, expect, it } from 'vitest';
import { startupMarks } from '../../src/features/diagnostics/startup-marks';
import {
  formatStartupTable,
  measureStages,
  median,
  medianStages,
  parseNativeTimeline,
  startupMilliseconds,
  type StartupTimestamps,
} from './startup-profile';

function launch(offset: number): StartupTimestamps {
  return {
    spawned: 1_000,
    processEntered: 1_050,
    pluginsInitialized: 1_070,
    setupStarted: 1_150,
    setupCompleted: 1_200,
    pageLoadStarted: 1_500 + offset,
    marks: {
      [startupMarks.scriptStarted]: 1_600 + offset,
      [startupMarks.windowShown]: 1_650 + offset,
      [startupMarks.vaultReadStarted]: 1_700 + offset,
      [startupMarks.vaultReadFinished]: 1_740 + offset,
      [startupMarks.usable]: 1_800 + offset,
      [startupMarks.searchIndexStarted]: 1_790 + offset,
      [startupMarks.searchIndexFinished]: 2_500 + offset,
    },
  };
}

function stage(stages: ReturnType<typeof measureStages>, name: string) {
  return stages.find((entry) => entry.stage === name)?.milliseconds;
}

describe('parseNativeTimeline', () => {
  it('keeps recorded times and treats missing steps as unknown', () => {
    expect(parseNativeTimeline({ processEntered: 1_050, setupCompleted: null })).toEqual({
      processEntered: 1_050,
      pluginsInitialized: null,
      setupStarted: null,
      setupCompleted: null,
      pageLoadStarted: null,
    });
  });

  it('rejects a reply that is not a timeline', () => {
    expect(() => parseNativeTimeline(null)).toThrow('missing');
    expect(() => parseNativeTimeline({ processEntered: 'soon' })).toThrow('processEntered');
  });
});

describe('median', () => {
  it('takes the middle value of an odd count, ignoring order', () => {
    expect(median([2_757, 1_305, 1_429])).toBe(1_429);
  });

  it('averages the middle pair of an even count', () => {
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });

  it('rejects an empty list', () => {
    expect(() => median([])).toThrow('at least one value');
  });
});

describe('startup stages', () => {
  it('splits one launch into consecutive stages', () => {
    const stages = measureStages(launch(0));

    expect(stage(stages, 'Process spawn to native entry')).toBe(50);
    expect(stage(stages, 'Plugin initialization')).toBe(20);
    expect(stage(stages, 'Event loop, window and WebView2 creation')).toBe(80);
    expect(stage(stages, 'Setup to page navigation')).toBe(300);
    expect(stage(stages, 'Vault scan (titles and metadata)')).toBe(40);
    expect(stage(stages, 'Search index build (background)')).toBe(710);
    expect(stage(stages, 'Total: spawn to Home usable')).toBe(800);
  });

  it('reports a stage as unknown when one of its points is missing', () => {
    const stages = measureStages({ ...launch(0), setupCompleted: null });

    expect(stage(stages, 'App setup hook (paths, tray)')).toBeNull();
    expect(stage(stages, 'Setup to page navigation')).toBeNull();
  });

  it('takes the median of each stage across launches', () => {
    const stages = medianStages([launch(0), launch(900), launch(100)]);

    expect(stage(stages, 'Setup to page navigation')).toBe(400);
    expect(stage(stages, 'Vault scan (titles and metadata)')).toBe(40);
  });

  it('formats the per-stage medians as a Markdown table', () => {
    const table = formatStartupTable('Debug build', [launch(0), launch(100), launch(900)]);

    expect(table).toContain('### Debug build (median of 3 launches)');
    expect(table).toContain('| Setup to page navigation | 400 |');
    expect(table).toContain('| Total: spawn to Home usable | 900 |');
  });

  it('measures startup from spawn to the usable Home screen', () => {
    expect(startupMilliseconds(launch(0))).toBe(800);
    expect(() => startupMilliseconds({ ...launch(0), marks: {} })).toThrow('usable Home');
  });
});
