import type { RepositoryResult } from '@/features/storage/repository-result';

export function unwrapResult<Value>(result: RepositoryResult<Value>): Value {
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}
