import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

// Fails on every npm advisory except reviewed exceptions, and on exceptions past their
// expiry date, so an accepted risk is re-checked instead of silently kept forever.
const exceptionsFile = new URL('./npm-audit-exceptions.json', import.meta.url);
const exceptions = JSON.parse(await readFile(exceptionsFile, 'utf8'));
const today = new Date().toISOString().slice(0, 10);

const expired = exceptions.filter((exception) => exception.expires < today);
for (const exception of expired)
  console.error(`Audit exception expired on ${exception.expires}: ${exception.advisory}`);

const audit = spawnSync('npm audit --json', { encoding: 'utf8', shell: true });
if (audit.error) throw audit.error;
let report;
try {
  report = JSON.parse(audit.stdout);
} catch (error) {
  throw new Error(`npm audit did not return JSON: ${audit.stderr || audit.stdout}`, {
    cause: error,
  });
}

const acceptedAdvisories = new Set(
  exceptions.filter((exception) => !expired.includes(exception)).map(({ advisory }) => advisory),
);
const unaccepted = [];
for (const [packageName, vulnerability] of Object.entries(report.vulnerabilities ?? {})) {
  for (const source of vulnerability.via) {
    if (typeof source === 'object' && !acceptedAdvisories.has(source.url))
      unaccepted.push(`${packageName}: ${source.severity} ${source.title} (${source.url})`);
  }
}

for (const finding of unaccepted) console.error(finding);
const accepted = Object.keys(report.vulnerabilities ?? {}).length > 0 && unaccepted.length === 0;
if (accepted) console.log(`Only reviewed advisories remain: ${[...acceptedAdvisories].join(', ')}`);
if (unaccepted.length > 0 || expired.length > 0) process.exitCode = 1;
else console.log('npm audit: no unreviewed advisories.');
