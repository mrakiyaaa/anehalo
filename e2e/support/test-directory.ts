import { homedir } from 'node:os';
import { resolve, join } from 'node:path';
import { lstat, mkdir, mkdtemp } from 'node:fs/promises';

export const testDirectoryParent = resolve(homedir(), '.anehalo-qa');

export async function createTestDirectory() {
  await mkdir(testDirectoryParent, { recursive: true });
  const metadata = await lstat(testDirectoryParent);
  if (!metadata.isDirectory() || metadata.isSymbolicLink())
    throw new Error('The QA directory must be a real directory.');
  return mkdtemp(join(testDirectoryParent, 'anehalo-e2e-'));
}
