import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(version))
  throw new Error('Usage: npm run version:bump -- 0.1.1');

for (const path of ['package.json', 'src-tauri/tauri.conf.json']) {
  const content = JSON.parse(await readFile(path, 'utf8'));
  content.version = version;
  await writeFile(path, `${JSON.stringify(content, null, 2)}\n`);
}
const manifestPath = 'src-tauri/Cargo.toml';
const manifest = await readFile(manifestPath, 'utf8');
await writeFile(manifestPath, manifest.replace(/^(version = ")[^"]+("\r?)$/m, `$1${version}$2`));
const lockPath = 'src-tauri/Cargo.lock';
const lock = await readFile(lockPath, 'utf8');
await writeFile(
  lockPath,
  lock.replace(/(\[\[package\]\]\r?\nname = "anehalo"\r?\nversion = ")[^"]+(")/, `$1${version}$2`),
);
const npm = spawnSync(
  process.execPath,
  [process.env.npm_execpath, 'install', '--package-lock-only', '--ignore-scripts'],
  { stdio: 'inherit' },
);
if (npm.error) throw npm.error;
if (npm.status !== 0) throw new Error('Could not update package-lock.json.');
console.log(`Synchronized Anehalo ${version}.`);
