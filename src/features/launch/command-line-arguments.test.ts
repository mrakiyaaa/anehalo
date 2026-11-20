import { describe, expect, it } from 'vitest';
import { parseCommandLineArguments } from './command-line-arguments';

describe('launch argument parsing', () => {
  it.each([
    { launchArguments: [], action: null },
    { launchArguments: ['--open'], action: { kind: 'open', path: null } },
    {
      launchArguments: ['--open', 'C:/Vault/Plans/Flow.excalidraw'],
      action: { kind: 'open', path: 'C:/Vault/Plans/Flow.excalidraw' },
    },
    { launchArguments: ['--new-note'], action: { kind: 'new-note' } },
    { launchArguments: ['--new-diagram'], action: { kind: 'new-diagram' } },
    { launchArguments: ['--new-diagram', '--new-diagram'], action: { kind: 'new-diagram' } },
    { launchArguments: ['--autostart'], action: { kind: 'background' } },
  ])('parses $launchArguments', ({ launchArguments, action }) => {
    expect(parseCommandLineArguments(launchArguments)).toEqual({ ok: true, value: action });
  });

  it.each([
    ['--unknown'],
    ['Flow.excalidraw'],
    ['--open', '--new-note'],
    ['--new-note', '--new-diagram'],
    ['--new-note', '--autostart'],
    ['--open', 'A.md', '--open', 'B.excalidraw'],
  ])('rejects unsupported or ambiguous arguments %j', (...launchArguments) => {
    expect(parseCommandLineArguments(launchArguments)).toMatchObject({
      ok: false,
      error: { code: 'invalid-name' },
    });
  });
});
