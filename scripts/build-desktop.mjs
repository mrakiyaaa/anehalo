import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const debug = process.argv.includes('--debug');
// Release compiler settings that keep the E2E test hooks; see [profile.e2e-release].
const e2eOptimized = process.argv.includes('--e2e-optimized');
const bundling = !debug && !e2eOptimized;
// tauri.conf.json asks for updater artifacts, which must be signed. QA and CI builds run
// without the release key, so they skip those artifacts; real releases (release.yml) have it.
const canSign = Boolean(process.env.TAURI_SIGNING_PRIVATE_KEY);
const skipUpdaterArtifacts = bundling && !canSign;
if (skipUpdaterArtifacts)
  console.log('No updater signing key is set: building the installer without updater artifacts.');

function buildArguments() {
  if (debug) return ['--debug', '--no-bundle'];
  if (e2eOptimized) return ['--no-bundle', '--', '--profile', 'e2e-release'];
  return ['--bundles', 'nsis'];
}

const result = spawnSync(
  process.execPath,
  [
    resolve('node_modules/@tauri-apps/cli/tauri.js'),
    'build',
    ...(skipUpdaterArtifacts
      ? ['--config', JSON.stringify({ bundle: { createUpdaterArtifacts: false } })]
      : []),
    ...buildArguments(),
  ],
  {
    stdio: 'inherit',
    env: { ...process.env, CARGO_TARGET_DIR: resolve('src-tauri/target/qa') },
  },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
