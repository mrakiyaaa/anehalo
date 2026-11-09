// Sets the app version in every file that stores it.
// Usage: npm run version:bump -- 0.1.1
//
// Versions are rewritten in place instead of re-serializing the JSON files, so
// formatting and line endings stay exactly as they are and the diff is minimal.
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Strict x.y.z: numbers only, no "v" prefix, no leading zeros, no pre-release suffix.
const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const version = process.argv[2];
if (process.argv.length !== 3 || !VERSION_PATTERN.test(version)) {
  console.error(
    `Invalid version "${process.argv.slice(2).join(' ')}". ` +
      'Use x.y.z with numbers only, for example: npm run version:bump -- 0.1.1',
  );
  process.exit(1);
}

// Every pattern captures: 1 = text before the version, 2 = the version, 3 = text after.
// ` {n}` matches n spaces of JSON indentation (written this way to satisfy no-regex-spaces).
const JSON_TOP_LEVEL_VERSION = /^( {2}"version": ")([^"]+)(")/m;
const targets = [
  { file: 'package.json', label: 'package.json', pattern: JSON_TOP_LEVEL_VERSION },
  {
    file: 'src-tauri/tauri.conf.json',
    label: 'src-tauri/tauri.conf.json',
    pattern: JSON_TOP_LEVEL_VERSION,
  },
  {
    file: 'src-tauri/Cargo.toml',
    label: 'src-tauri/Cargo.toml',
    // The version line inside the [package] table, before any other table.
    pattern: /(^\[package\]\r?\n(?:(?!\[)[^\r\n]*\r?\n)*?version = ")([^"]+)(")/m,
  },
  { file: 'package-lock.json', label: 'package-lock.json', pattern: JSON_TOP_LEVEL_VERSION },
  {
    file: 'package-lock.json',
    label: 'package-lock.json (root package)',
    pattern: /^( {4}"": \{\r?\n {6}"name": "[^"]+",\r?\n {6}"version": ")([^"]+)(")/m,
  },
  {
    file: 'src-tauri/Cargo.lock',
    label: 'src-tauri/Cargo.lock',
    pattern: /(\[\[package\]\]\r?\nname = "anehalo"\r?\nversion = ")([^"]+)(")/,
  },
];

// Compute every new file in memory first, so a failure leaves the repository untouched.
const contents = new Map();
const changes = [];
for (const { file, label, pattern } of targets) {
  const text = contents.get(file) ?? (await readFile(resolve(root, file), 'utf8'));
  const match = pattern.exec(text);
  if (!match) {
    throw new Error(
      `Could not find the version in ${label}. ` +
        'The file layout may have changed; update scripts/bump-version.mjs.',
    );
  }
  changes.push({ label, from: match[2] });
  contents.set(
    file,
    text.replace(pattern, (_whole, before, _old, after) => `${before}${version}${after}`),
  );
}

// Check the result before writing anything.
for (const [file, text] of contents) {
  if (file.endsWith('.json')) JSON.parse(text);
}
for (const { file, label, pattern } of targets) {
  if (pattern.exec(contents.get(file))?.[2] !== version)
    throw new Error(`Could not set the version in ${label}.`);
}

for (const [file, text] of contents) {
  await writeFile(resolve(root, file), text);
}

const width = Math.max(...changes.map(({ label }) => label.length));
const changed = changes.filter(({ from }) => from !== version);
console.log(`Anehalo version ${version}`);
for (const { label, from } of changes) {
  const note = from === version ? 'already up to date' : `${from} -> ${version}`;
  console.log(`  ${label.padEnd(width)}  ${note}`);
}
console.log(
  changed.length === 0
    ? 'Nothing changed: every file already uses this version.'
    : `Updated ${changed.length} of ${changes.length} entries.`,
);
