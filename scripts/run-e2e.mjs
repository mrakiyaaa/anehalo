import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const environment = { ...process.env };
// Playwright forces color in workers; Node warns when NO_COLOR is also inherited.
delete environment.NO_COLOR;
const result = spawnSync(
  process.execPath,
  [resolve('node_modules/@playwright/test/cli.js'), 'test', ...process.argv.slice(2)],
  { stdio: 'inherit', env: environment },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
