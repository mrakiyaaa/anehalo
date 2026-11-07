import { readFile } from 'node:fs/promises';

const packageVersion = JSON.parse(await readFile('package.json', 'utf8')).version;
const configurationVersion = JSON.parse(
  await readFile('src-tauri/tauri.conf.json', 'utf8'),
).version;
const manifestVersion = (await readFile('src-tauri/Cargo.toml', 'utf8')).match(
  /^version = "([^"]+)"/m,
)?.[1];
const lockVersion = JSON.parse(await readFile('package-lock.json', 'utf8')).version;
const cargoLockVersion = (await readFile('src-tauri/Cargo.lock', 'utf8')).match(
  /name = "anehalo"\r?\nversion = "([^"]+)"/,
)?.[1];
if (
  [configurationVersion, manifestVersion, lockVersion, cargoLockVersion].some(
    (version) => version !== packageVersion,
  )
)
  throw new Error('Versions differ. Run npm run version:bump -- <version>.');
if (process.env.GITHUB_REF_TYPE === 'tag' && process.env.GITHUB_REF_NAME !== `v${packageVersion}`)
  throw new Error('The tag must match the application version.');
console.log(`All manifests and lockfiles use ${packageVersion}.`);
