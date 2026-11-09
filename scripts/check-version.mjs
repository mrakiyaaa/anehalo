// Fails unless every file that stores the app version agrees, and, when run for
// a tag push, unless the tag (without the leading "v") equals that version.
import { readFile } from 'node:fs/promises';

const readText = (path) => readFile(path, 'utf8');
const versions = [
  ['package.json', JSON.parse(await readText('package.json')).version],
  ['src-tauri/tauri.conf.json', JSON.parse(await readText('src-tauri/tauri.conf.json')).version],
  [
    'src-tauri/Cargo.toml',
    (await readText('src-tauri/Cargo.toml')).match(
      /^\[package\]\r?\n(?:(?!\[)[^\r\n]*\r?\n)*?version = "([^"]+)"/m,
    )?.[1],
  ],
  ['package-lock.json', JSON.parse(await readText('package-lock.json')).version],
  [
    'src-tauri/Cargo.lock',
    (await readText('src-tauri/Cargo.lock')).match(/name = "anehalo"\r?\nversion = "([^"]+)"/)?.[1],
  ],
];

function fail(summary, details) {
  // Shows as an annotation on the workflow run page when running in GitHub Actions.
  if (process.env.GITHUB_ACTIONS === 'true')
    console.error(`::error title=Version check failed::${summary}`);
  console.error([`Version check failed: ${summary}`, ...details].join('\n'));
  process.exit(1);
}

const packageVersion = versions[0][1];
const width = Math.max(...versions.map(([file]) => file.length));
const table = versions.map(
  ([file, version]) =>
    `  ${file.padEnd(width)}  ${version ?? '(not found)'}${version === packageVersion ? '' : '   <-- differs'}`,
);

if (versions.some(([, version]) => version !== packageVersion))
  fail('the version is not the same in every file.', [
    ...table,
    'Fix: npm run version:bump -- <version>, then commit.',
  ]);

if (process.env.GITHUB_REF_TYPE === 'tag') {
  const tag = process.env.GITHUB_REF_NAME;
  if (tag !== `v${packageVersion}`)
    fail(`tag ${tag} does not match the app version ${packageVersion}.`, [
      ...table,
      `Either push the tag v${packageVersion}, or bump the version, commit, and tag again.`,
    ]);
}

console.log(`All manifests and lockfiles use ${packageVersion}.`);
