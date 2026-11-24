import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';

/** Fills in the native Save dialog; `title` is the dialog's title, by default the note's. */
export async function saveNativeDialog(
  applicationProcessId: number,
  destination: string,
  title = 'Save as Markdown',
): Promise<void> {
  await runNativeDialog(
    'save-dialog.ps1',
    applicationProcessId,
    '-Destination',
    destination,
    '-Title',
    title,
  );
}

/** The application's windows (a dialog that never closed shows up here), for failure messages. */
export async function describeNativeWindows(applicationProcessId: number): Promise<string> {
  try {
    const { stdout } = await promisify(execFile)(
      'powershell.exe',
      [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        resolve('e2e/support', 'describe-windows.ps1'),
        '-ApplicationProcessId',
        String(applicationProcessId),
      ],
      { windowsHide: true, timeout: 20_000 },
    );
    return stdout.trim();
  } catch (error) {
    return `unavailable (${String(error)})`;
  }
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
  ...scriptArguments: string[]
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
      ...scriptArguments,
    ],
    { windowsHide: true, timeout: 20_000 },
  );
}
