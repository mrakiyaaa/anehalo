import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const result = spawnSync(
  process.execPath,
  [
    resolve('node_modules/@tauri-apps/cli/tauri.js'),
    'build',
    ...(process.argv.includes('--debug') ? ['--debug', '--no-bundle'] : ['--bundles', 'nsis']),
  ],
  {
    stdio: 'inherit',
    env: { ...process.env, CARGO_TARGET_DIR: resolve('src-tauri/target/qa') },
  },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
