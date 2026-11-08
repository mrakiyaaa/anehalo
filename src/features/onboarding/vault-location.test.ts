import { describe, expect, it } from 'vitest';
import {
  resolveVaultPath,
  validateSavedVaultPath,
  validateVaultLocation,
  type VaultLocationInspection,
} from './vault-location';

describe('vault location resolution', () => {
  it.each([
    ['D:\\Notes', 'D:\\Notes\\Anehalo'],
    ['D:\\Notes\\', 'D:\\Notes\\Anehalo'],
    ['D:/Notes/', 'D:/Notes/Anehalo'],
    ['D:\\Notes\\Anehalo', 'D:\\Notes\\Anehalo'],
    ['D:\\Notes\\aNeHaLo\\', 'D:\\Notes\\aNeHaLo'],
    ['D:\\', 'D:\\Anehalo'],
    ['\\\\server\\share\\Notes', '\\\\server\\share\\Notes\\Anehalo'],
    ['D:\\මගේ සටහන් 🌼', 'D:\\මගේ සටහන් 🌼\\Anehalo'],
  ])('resolves %s', (picked, expected) => expect(resolveVaultPath(picked)).toBe(expected));

  it.each([
    'C:\\',
    'D:/',
    'C:\\Windows',
    'C:\\WINDOWS\\System32',
    'C:\\Program Files\\Notes',
    'C:\\Program Files (x86)',
    'C:\\ProgramData',
    'C:\\Users\\Akila\\AppData\\Local',
    'C:\\Users\\Akila\\AppData\\Roaming',
    'D:/Notes/../Windows',
    'D:/Notes/' + 'x'.repeat(241),
  ])('rejects unsafe location %s', (path) => {
    expect(validateVaultLocation(path).ok).toBe(false);
  });

  const writable: VaultLocationInspection = {
    locationType: 'directory',
    vaultType: 'missing',
    writable: true,
  };
  it('allows writable personal locations and existing copied vaults', () => {
    expect(validateVaultLocation('D:/Notes', writable).ok).toBe(true);
    expect(
      validateVaultLocation('D:/Notes/Anehalo', { ...writable, vaultType: 'directory' }).ok,
    ).toBe(true);
  });
  it.each([
    { inspection: { ...writable, writable: false }, code: 'permission-denied' },
    { inspection: { ...writable, vaultType: 'file' as const }, code: 'invalid-type' },
    { inspection: { ...writable, vaultType: 'link' as const }, code: 'invalid-path' },
    { inspection: { ...writable, locationType: 'missing' as const }, code: 'not-found' },
  ])('rejects $code with a typed result', ({ inspection, code }) => {
    expect(validateVaultLocation('D:/Notes', inspection)).toMatchObject({
      ok: false,
      error: { code },
    });
  });
  it('requires reconfirmation of an old parent vault without scanning or moving files', () => {
    expect(validateSavedVaultPath('D:/Documents')).toMatchObject({
      ok: false,
      error: { code: 'legacy-vault' },
    });
    expect(validateSavedVaultPath('D:/Documents/ANEHALO').ok).toBe(true);
  });
});
