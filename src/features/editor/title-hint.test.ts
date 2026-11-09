import { describe, expect, it } from 'vitest';
import { describeTitleChange } from '@/features/editor/title-hint';
import { MAXIMUM_NAME_LENGTH } from '@/features/storage/note-names';

describe('describeTitleChange', () => {
  it('says nothing when the saved title is what was typed', () => {
    expect(describeTitleChange('Shopping list', 'Shopping list')).toBeNull();
    expect(describeTitleChange('  Shopping list  ', 'Shopping list')).toBeNull();
    expect(describeTitleChange('Shopping list.md', 'Shopping list')).toBeNull();
    expect(describeTitleChange('plan', 'plan')).toBeNull();
  });

  it('says a name was already used when a number was added', () => {
    expect(describeTitleChange('Shopping list', 'Shopping list 2')).toBe(
      'Renamed to Shopping list 2 (name already used)',
    );
  });

  it('says characters were removed when only the characters changed', () => {
    expect(describeTitleChange('Plan/B: now?', 'PlanB now')).toBe(
      'Renamed to PlanB now (invalid characters removed)',
    );
    expect(describeTitleChange('Plan.', 'Plan')).toBe(
      'Renamed to Plan (invalid characters removed)',
    );
  });

  it('prefers the clash when both a clash and removed characters apply', () => {
    expect(describeTitleChange('a/b', 'ab 2')).toBe('Renamed to ab 2 (name already used)');
  });

  it('says when a long name was shortened', () => {
    const long = 'x'.repeat(MAXIMUM_NAME_LENGTH + 20);
    expect(describeTitleChange(long, 'x'.repeat(MAXIMUM_NAME_LENGTH))).toBe(
      `Renamed to ${'x'.repeat(MAXIMUM_NAME_LENGTH)} (name shortened to ${MAXIMUM_NAME_LENGTH} characters)`,
    );
  });

  it('expects an emptied title to become "Untitled note" and explains only a taken name', () => {
    expect(describeTitleChange('', 'Untitled note')).toBeNull();
    expect(describeTitleChange(' . ', 'Untitled note')).toBeNull();
    expect(describeTitleChange('', 'Untitled note 2')).toBe(
      'Renamed to Untitled note 2 (name already used)',
    );
  });
});
