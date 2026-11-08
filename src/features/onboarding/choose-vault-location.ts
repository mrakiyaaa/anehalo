import type { FolderAccess } from './FolderAccess';
import { resolveVaultPath, validateVaultLocation } from './vault-location';
import type { RepositoryResult } from '@/features/storage/repository-result';
import { success } from '@/features/storage/repository-result';

export async function chooseVaultLocation(
  access: FolderAccess,
): Promise<RepositoryResult<string | null>> {
  const picked = await access.choose();
  if (!picked.ok || picked.value === null) return picked;
  const location = validateVaultLocation(picked.value);
  if (!location.ok) return location;
  const path = resolveVaultPath(picked.value);
  const prepared = await access.validate(path);
  return prepared.ok ? success(path) : prepared;
}
