import { describe, expect, it } from 'vitest';
import { formatRelativeTime } from '@/lib/relative-time';

describe('relative modification times', () => {
  const now = new Date(2026, 10, 4, 14, 30).getTime();
  it('formats recent edits, yesterday, and calendar days', () => {
    expect(formatRelativeTime(now - 12000, now)).toBe('Just now');
    expect(formatRelativeTime(now - 12 * 60000, now)).toBe('12 min ago');
    expect(formatRelativeTime(now - 2 * 3600000, now)).toBe('2 hr ago');
    expect(formatRelativeTime(new Date(2026, 10, 3, 23, 50).getTime(), now)).toBe('Yesterday');
    expect(formatRelativeTime(new Date(2026, 10, 2, 0, 0).getTime(), now)).toBe('2 days ago');
    expect(formatRelativeTime(0, now)).toBe('Unknown time');
  });
});
