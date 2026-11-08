import { invoke } from '@tauri-apps/api/core';
import { validateSavedVaultPath } from '@/features/onboarding/vault-location';
import { StorageFailure } from './repository-result';
import { ScanBudget } from './ScanBudget';

export async function openVaultAccess(path: string): Promise<string> {
  const valid = validateSavedVaultPath(path);
  if (!valid.ok) throw new StorageFailure(valid.error);
  await new ScanBudget().wait(invoke('prepare_vault', { vaultPath: path, create: false }));
  return path;
}
