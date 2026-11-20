import { describe, expect, it } from 'vitest';
import { launchItemPath } from './launch-item-path';

describe('launchItemPath', () => {
  it.each([
    ['C:\\Users\\Ada\\Vault\\Plans\\Flow.excalidraw', 'Plans/Flow.excalidraw'],
    ['c:\\users\\ada\\vault\\Notes.md', 'Notes.md'],
    ['Plans/Flow.excalidraw', 'Plans/Flow.excalidraw'],
  ])('resolves %s inside the vault', (path, relative) => {
    expect(launchItemPath('C:\\Users\\Ada\\Vault\\', path)).toEqual({ ok: true, value: relative });
  });

  it.each([
    ['C:\\Users\\Ada\\Other\\Flow.excalidraw', 'invalid-path'],
    ['C:\\Users\\Ada\\Vault\\..\\Flow.excalidraw', 'invalid-path'],
    ['C:\\Users\\Ada\\Vault\\.trash\\Flow.excalidraw', 'invalid-path'],
    ['C:\\Users\\Ada\\Vault\\Photo.png', 'invalid-name'],
  ])('refuses %s', (path, code) => {
    expect(launchItemPath('C:\\Users\\Ada\\Vault', path)).toMatchObject({
      ok: false,
      error: { code },
    });
  });
});
