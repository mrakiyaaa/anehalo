import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { TauriFolderAccess } from './TauriFolderAccess';
import { chooseVaultLocation } from './choose-vault-location';
import configuration from '../../../src-tauri/capabilities/default.json';
import { openVaultAccess } from '@/features/storage/open-vault-access';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));

describe('vault-only native folder access', () => {
  it('restores an existing vault grant without recreating a missing saved folder', async () => {
    vi.mocked(invoke).mockResolvedValueOnce(undefined);
    expect(await openVaultAccess('D:/Notes/Anehalo')).toBe('D:/Notes/Anehalo');
    expect(invoke).toHaveBeenCalledWith('prepare_vault', {
      vaultPath: 'D:/Notes/Anehalo',
      create: false,
    });
    await expect(openVaultAccess('D:/Notes')).rejects.toMatchObject({
      storageError: { code: 'legacy-vault' },
    });
    expect(invoke).toHaveBeenCalledOnce();
  });
  it('picks a location without requesting a recursive parent grant and prepares only its child', async () => {
    vi.mocked(invoke).mockResolvedValueOnce('D:/Notes').mockResolvedValueOnce(undefined);
    expect(await chooseVaultLocation(new TauriFolderAccess())).toEqual({
      ok: true,
      value: 'D:/Notes/Anehalo',
    });
    expect(invoke).toHaveBeenNthCalledWith(1, 'pick_vault_location');
    expect(invoke).toHaveBeenNthCalledWith(2, 'prepare_vault', {
      vaultPath: 'D:/Notes/Anehalo',
      create: true,
    });
  });
  it('reuses a selected Anehalo folder and returns native permission and file conflicts explicitly', async () => {
    vi.mocked(invoke).mockResolvedValueOnce('D:/Notes/ANEHALO').mockResolvedValueOnce(undefined);
    expect(await chooseVaultLocation(new TauriFolderAccess())).toEqual({
      ok: true,
      value: 'D:/Notes/ANEHALO',
    });
    vi.mocked(invoke).mockRejectedValueOnce({
      code: 'invalid-type',
      message: 'A file named Anehalo already exists here.',
    });
    expect(await new TauriFolderAccess().validate('D:/Notes/Anehalo')).toMatchObject({
      ok: false,
      error: { code: 'invalid-type' },
    });
    vi.mocked(invoke).mockRejectedValueOnce({
      code: 'permission-denied',
      message: 'The folder is not writable.',
    });
    expect(await new TauriFolderAccess().validate('D:/Notes/Anehalo')).toMatchObject({
      ok: false,
      error: { code: 'permission-denied' },
    });
  });
  it('rejects system locations before preparing or granting any folder', async () => {
    vi.mocked(invoke).mockResolvedValueOnce('C:/Windows');
    expect((await chooseVaultLocation(new TauriFolderAccess())).ok).toBe(false);
    expect(invoke).toHaveBeenCalledOnce();
  });
  it('retains only static settings scope and does not load legacy persisted parent grants', () => {
    const scope = configuration.permissions.find(
      (permission) => typeof permission === 'object' && permission.identifier === 'fs:scope',
    );
    if (typeof scope !== 'object') throw new Error('Filesystem scope is missing.');
    expect(scope.allow.every(({ path }) => path.startsWith('$APPCONFIG'))).toBe(true);
    const native = readFileSync('src-tauri/src/vault_access.rs', 'utf8');
    expect(native).toContain('.allow_directory(root, true)');
    expect(native).not.toContain('.allow_directory(&picked');
    const startup = readFileSync('src-tauri/src/lib.rs', 'utf8');
    expect(startup).not.toContain('tauri_plugin_persisted_scope');
    expect(native).toContain('is_saved_vault(app, root)');
  });
});
