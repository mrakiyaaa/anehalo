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
  try {
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
      // Longer than the script's own waits added up (find, controls, retries), so the script
      // always gets to report what went wrong instead of being cut off.
      { windowsHide: true, timeout: 60_000 },
    );
  } catch (error) {
    // The script reports each step it reached; without them a failure only names the command.
    const output =
      typeof error === 'object' && error !== null && 'stdout' in error && 'stderr' in error
        ? `${String(error.stdout)} ${String(error.stderr)}`.replace(/\s+/g, ' ').trim()
        : '';
    const killed = typeof error === 'object' && error !== null && 'killed' in error && error.killed;
    throw new Error(`${script} failed${killed ? ' (timed out)' : ''}: ${output || String(error)}`, {
      cause: error,
    });
  }
}
