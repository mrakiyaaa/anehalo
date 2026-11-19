import { afterEach, describe, expect, it } from 'vitest';
import { hasStartupMark, markStartupOnce, startupMarks } from './startup-marks';

describe('startup marks', () => {
  afterEach(() => performance.clearMarks());

  it('records a mark the first time only', () => {
    markStartupOnce(startupMarks.usable);
    const first = performance.getEntriesByName(startupMarks.usable, 'mark')[0];
    markStartupOnce(startupMarks.usable);

    const marks = performance.getEntriesByName(startupMarks.usable, 'mark');
    expect(marks).toHaveLength(1);
    expect(marks[0]).toBe(first);
  });

  it('keeps each startup stage independent', () => {
    markStartupOnce(startupMarks.vaultReadStarted);

    expect(hasStartupMark(startupMarks.vaultReadStarted)).toBe(true);
    expect(hasStartupMark(startupMarks.vaultReadFinished)).toBe(false);
  });

  it('uses a distinct name for every stage', () => {
    const names = Object.values(startupMarks);
    expect(new Set(names).size).toBe(names.length);
  });
});
