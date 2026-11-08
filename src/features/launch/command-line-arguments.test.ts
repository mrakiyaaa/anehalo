import { describe, expect, it } from 'vitest';
import { parseCommandLineArguments } from './command-line-arguments';

describe('launch argument parsing', () => {
  it.each([
    { launchArguments: [], action: null },
    { launchArguments: ['--open'], action: 'open' },
    { launchArguments: ['--new-note'], action: 'new-note' },
    { launchArguments: ['--autostart'], action: 'background' },
  ])('parses $launchArguments', ({ launchArguments, action }) => {
    expect(parseCommandLineArguments(launchArguments)).toEqual({ ok: true, value: action });
  });

  it.each([['--unknown'], ['--open', '--new-note'], ['--new-note', '--autostart']])(
    'rejects unsupported or ambiguous arguments %j',
    (...launchArguments) => {
      expect(parseCommandLineArguments(launchArguments)).toMatchObject({
        ok: false,
        error: { code: 'invalid-name' },
      });
    },
  );
});
