/**
 * Which executable the E2E harness launches. Both keep debug assertions, because the isolated
 * test root and the DevTools port exist only with them; "optimized" otherwise uses the release
 * profile's compiler settings (see [profile.e2e-release] in src-tauri/Cargo.toml).
 */
export type E2eBuild = 'debug' | 'optimized';

const executables: Record<E2eBuild, string> = {
  debug: 'src-tauri/target/qa/debug/anehalo.exe',
  optimized: 'src-tauri/target/qa/e2e-release/anehalo.exe',
};

export function selectedE2eBuild(): E2eBuild {
  const requested = process.env.ANEHALO_E2E_BUILD ?? 'debug';
  if (requested === 'debug' || requested === 'optimized') return requested;
  throw new Error(`ANEHALO_E2E_BUILD must be "debug" or "optimized", not "${requested}".`);
}

export function e2eExecutable(build: E2eBuild): string {
  return executables[build];
}
