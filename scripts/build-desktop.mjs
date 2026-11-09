import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const debug = process.argv.includes('--debug');
// tauri.conf.json asks for updater artifacts, which must be signed. QA and CI builds run
// without the release key, so they skip those artifacts; real releases (release.yml) have it.
const canSign = Boolean(process.env.TAURI_SIGNING_PRIVATE_KEY);
const skipUpdaterArtifacts = !debug && !canSign;
if (skipUpdaterArtifacts)
  console.log('No updater signing key is set: building the installer without updater artifacts.');

const result = spawnSync(
  process.execPath,
  [
    resolve('node_modules/@tauri-apps/cli/tauri.js'),
    'build',
    ...(debug ? ['--debug', '--no-bundle'] : ['--bundles', 'nsis']),
    ...(skipUpdaterArtifacts
      ? ['--config', JSON.stringify({ bundle: { createUpdaterArtifacts: false } })]
      : []),
  ],
  {
    stdio: 'inherit',
    env: { ...process.env, CARGO_TARGET_DIR: resolve('src-tauri/target/qa') },
  },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
