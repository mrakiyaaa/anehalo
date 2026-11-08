import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';

export async function saveNativeDialog(
  applicationProcessId: number,
  destination: string,
): Promise<void> {
  await runNativeDialog('save-dialog.ps1', applicationProcessId, '-Destination', destination);
}

export async function selectNativeFolder(
  applicationProcessId: number,
  directory: string,
): Promise<void> {
  await runNativeDialog('select-folder.ps1', applicationProcessId, '-Directory', directory);
}

async function runNativeDialog(
  script: string,
  applicationProcessId: number,
  argument: string,
  value: string,
): Promise<void> {
  await promisify(execFile)(
    'powershell.exe',
    [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      resolve('e2e/support', script),
      '-ApplicationProcessId',
      String(applicationProcessId),
      argument,
      value,
    ],
    { windowsHide: true, timeout: 20_000 },
  );
}
