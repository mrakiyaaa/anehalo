import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';

export async function saveNativeDialog(
  applicationProcessId: number,
  destination: string,
): Promise<void> {
  await promisify(execFile)(
    'powershell.exe',
    [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      resolve('e2e/support/save-dialog.ps1'),
      '-ApplicationProcessId',
      String(applicationProcessId),
      '-Destination',
      destination,
    ],
    { windowsHide: true, timeout: 20_000 },
  );
}
