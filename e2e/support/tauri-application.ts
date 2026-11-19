import { spawn, execFile, type ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import { once } from 'node:events';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { chromium, expect, type Browser, type Page } from '@playwright/test';
import { defaultSettings, type AppSettings } from '../../src/features/settings/AppSettings';
import { startupMarks, type StartupMark } from '../../src/features/diagnostics/startup-marks';
import { e2eExecutable, selectedE2eBuild } from './e2e-build';
import { parseNativeTimeline, type StartupTimestamps } from './startup-profile';

const executeFile = promisify(execFile);

export class TauriApplication {
  private process: ChildProcess | undefined;
  private browser: Browser | undefined;
  private activePage: Page | undefined;
  readonly errors: string[] = [];
  startupMilliseconds = 0;
  private startedEpoch = 0;
  private nativeOutput = '';

  private launchCount = 0;

  /** @param traceDirectory Where to keep a Playwright trace of each launch, or null for none. */
  constructor(
    readonly root: string,
    private readonly traceDirectory: string | null = null,
  ) {}

  get vault() {
    return join(this.root, 'Anehalo');
  }
  get settingsPath() {
    return join(this.root, 'settings', 'settings.json');
  }
  get processIdentifier() {
    if (!this.process?.pid) throw new Error('The application process is unavailable.');
    return this.process.pid;
  }
  get page(): Page {
    if (!this.activePage) throw new Error('The application is not connected.');
    return this.activePage;
  }
  async directoryAllowed(directory: string) {
    return this.page.evaluate(async (path) => {
      const desktop = window as unknown as {
        __TAURI_INTERNALS__: {
          invoke: (
            command: string,
            parameters: { path: string; options: Record<string, never> },
          ) => Promise<unknown>;
        };
      };
      try {
        await desktop.__TAURI_INTERNALS__.invoke('plugin:fs|read_dir', { path, options: {} });
        return true;
      } catch (error) {
        if (/forbidden|not allowed|permission|scope/i.test(String(error))) return false;
        throw new Error(`Unexpected filesystem response: ${String(error)}`, { cause: error });
      }
    }, directory);
  }

  async seedSettings(patch: Partial<AppSettings> = {}) {
    await mkdir(join(this.root, 'settings'), { recursive: true });
    await mkdir(this.vault, { recursive: true });
    await writeFile(
      this.settingsPath,
      JSON.stringify({
        ...defaultSettings(this.vault),
        onboardingCompleted: true,
        keepRunningInTray: false,
        theme: 'light',
        ...patch,
      }),
    );
  }

  async start(launchArguments: readonly string[] = []) {
    if (process.platform !== 'win32')
      throw new Error('Real Tauri E2E tests require Windows/WebView2.');
    // A port file left by the previous launch would point at a closed port. Its WebView2
    // process can hold the file for a moment after being killed, hence the retries.
    await rm(this.devtoolsPortFile, { force: true, maxRetries: 20, retryDelay: 100 });
    const started = performance.now();
    this.startedEpoch = Date.now();
    this.process = spawn(resolve(e2eExecutable(selectedE2eBuild())), launchArguments, {
      env: {
        ...process.env,
        ANEHALO_TEST_ROOT: this.root,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let launchError: Error | undefined;
    this.process.on('error', (error) => {
      launchError = error;
    });
    this.process.stderr?.on('data', (chunk: Buffer) => {
      this.nativeOutput += chunk.toString();
    });
    this.process.stdout?.on('data', (chunk: Buffer) => {
      this.nativeOutput += chunk.toString();
    });
    const devtoolsEndpoint = await this.waitForDevtools(() => launchError);
    this.browser = await chromium.connectOverCDP(devtoolsEndpoint);
    const context = this.browser.contexts()[0];
    if (!context) throw new Error('WebView2 did not expose a browser context.');
    this.launchCount += 1;
    if (this.traceDirectory) await context.tracing.start({ screenshots: true, snapshots: true });
    this.activePage = context.pages()[0] ?? (await context.waitForEvent('page'));
    this.page.on('pageerror', (error) => this.errors.push(error.stack ?? error.message));
    this.page.on('console', (message) => {
      if (message.type() === 'error') this.errors.push(message.text());
    });
    await this.page.emulateMedia({ reducedMotion: 'reduce' });
    await this.page.getByRole('button', { name: 'Close', exact: true }).waitFor();
    this.startupMilliseconds = performance.now() - started;
  }

  /** WebView2 writes the port it chose to this file inside the isolated profile. */
  private get devtoolsPortFile() {
    return join(this.root, 'runtime', 'EBWebView', 'DevToolsActivePort');
  }

  private async readDevtoolsPort(): Promise<string | null> {
    try {
      const port = (await readFile(this.devtoolsPortFile, 'utf8')).split(/\r?\n/)[0]?.trim();
      return port && /^\d+$/.test(port) ? port : null;
    } catch (error) {
      // Missing until WebView2 starts, and locked while WebView2 is still writing it.
      const notReadyYet = ['ENOENT', 'EBUSY'];
      if (error instanceof Error && 'code' in error && notReadyYet.includes(String(error.code)))
        return null;
      throw error;
    }
  }

  private async waitForDevtools(launchError: () => Error | undefined): Promise<string> {
    const deadline = performance.now() + 20_000;
    while (performance.now() < deadline) {
      const error = launchError();
      if (error) throw error;
      if (this.process?.exitCode !== null) break;
      const port = await this.readDevtoolsPort();
      if (port) {
        const endpoint = `http://127.0.0.1:${port}`;
        try {
          if ((await fetch(`${endpoint}/json/version`)).ok) return endpoint;
        } catch {
          // The port file can appear just before the server accepts connections.
        }
      }
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
    }
    throw new Error(await this.describeFailedLaunch());
  }

  /** Startup failures on CI leave no window to look at, so report everything the process left. */
  private async describeFailedLaunch(): Promise<string> {
    const exitCode = this.process?.exitCode;
    const state =
      exitCode === null || exitCode === undefined
        ? 'still running after 20 s'
        : `exited with code ${exitCode}`;
    let runtimeLog: string;
    try {
      runtimeLog = (await this.log()).slice(-2_000);
    } catch (error) {
      runtimeLog = `unavailable (${String(error)})`;
    }
    const port = await this.readDevtoolsPort();
    return [
      `WebView2 never opened its DevTools port; the Tauri process ${state}.`,
      `DevTools port file: ${port ?? 'missing'}`,
      `WebView2 browser command line: ${await this.webviewCommandLine()}`,
      `Native output: ${this.nativeOutput.slice(-2_000) || '(none)'}`,
      `Runtime log: ${runtimeLog || '(empty)'}`,
    ].join('\n');
  }

  /** Shows whether the debugging argument actually reached this test's WebView2 browser. */
  private async webviewCommandLine(): Promise<string> {
    try {
      const result = await executeFile(
        'powershell.exe',
        [
          '-NoProfile',
          '-Command',
          'Get-CimInstance Win32_Process -Filter "Name=\'msedgewebview2.exe\'" | ForEach-Object { $_.CommandLine }',
        ],
        { windowsHide: true, timeout: 10_000 },
      );
      const browser = result.stdout
        .split(/\r?\n/)
        .find((line) => line.includes(this.root) && !line.includes('--type='));
      return browser?.slice(0, 1_500) ?? '(no browser process for this test root)';
    } catch (error) {
      return `unavailable (${String(error)})`;
    }
  }

  async waitForExit() {
    const applicationProcess = this.process;
    if (!applicationProcess) throw new Error('The application was not launched.');
    if (applicationProcess.exitCode === null) {
      await Promise.race([
        once(applicationProcess, 'exit'),
        new Promise<never>((_, reject) => {
          const timer = setTimeout(
            () => reject(new Error('The app did not close after flushing.')),
            10_000,
          );
          timer.unref();
        }),
      ]);
    }
  }

  async stop() {
    const running = this.process;
    // A trace can be saved only while WebView2 is still connected.
    if (this.traceDirectory && running?.exitCode === null)
      await this.browser?.contexts()[0]?.tracing.stop({
        path: join(this.traceDirectory, `launch-${this.launchCount}.zip`),
      });
    if (running?.pid && running.exitCode === null) {
      try {
        await executeFile('taskkill', ['/PID', String(running.pid), '/T', '/F'], {
          timeout: 10_000,
        });
      } catch (error) {
        // WebView children can exit between taskkill's enumeration and termination.
        if (running.exitCode === null) throw error;
      }
    }
    await this.browser?.close();
    this.process = undefined;
    this.activePage = undefined;
    this.browser = undefined;
  }

  async restart() {
    await this.stop();
    await this.start();
  }
  async note(relativePath: string): Promise<string | null> {
    try {
      return await readFile(join(this.vault, relativePath), 'utf8');
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
      throw error;
    }
  }
  async vaultExists(): Promise<boolean> {
    try {
      return (await stat(this.vault)).isDirectory();
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return false;
      throw error;
    }
  }
  async settings(): Promise<unknown> {
    return JSON.parse(await readFile(this.settingsPath, 'utf8')) as unknown;
  }
  /** The note the app reopens on its next start, as saved on disk. */
  async savedLastOpenedNote(): Promise<unknown> {
    const settings = await this.settings();
    return typeof settings === 'object' && settings !== null && 'lastOpenedNotePath' in settings
      ? settings.lastOpenedNotePath
      : undefined;
  }
  async memory(): Promise<unknown> {
    const result = await executeFile(
      'powershell.exe',
      [
        '-NoProfile',
        '-File',
        resolve('e2e/support/process-memory.ps1'),
        '-ApplicationProcessId',
        String(this.processIdentifier),
      ],
      { windowsHide: true },
    );
    return JSON.parse(result.stdout) as unknown;
  }
  /** Waits for the background search index too, so every stage of the launch is present. */
  async startupTimestamps(): Promise<StartupTimestamps> {
    await expect
      .poll(() => this.pageMarkTimes().then((marks) => marks[startupMarks.searchIndexFinished]), {
        timeout: 30_000,
      })
      .toBeDefined();
    const native = await this.page.evaluate(() => {
      const desktop = window as unknown as {
        __TAURI_INTERNALS__: { invoke: (command: string) => Promise<unknown> };
      };
      return desktop.__TAURI_INTERNALS__.invoke('startup_timeline');
    });
    return {
      spawned: this.startedEpoch,
      ...parseNativeTimeline(native),
      marks: await this.pageMarkTimes(),
    };
  }
  private async pageMarkTimes(): Promise<Partial<Record<StartupMark, number>>> {
    const names: StartupMark[] = Object.values(startupMarks);
    const entries = await this.page.evaluate(
      (markNames) =>
        markNames.flatMap((name) => {
          const mark = performance.getEntriesByName(name, 'mark')[0];
          return mark ? [[name, performance.timeOrigin + mark.startTime] as const] : [];
        }),
      names,
    );
    return Object.fromEntries(entries);
  }
  /** A new WebView2 profile makes every measured launch a first launch, as in a fresh install. */
  async resetWebviewProfile() {
    if (this.process)
      throw new Error('Stop the application before resetting its WebView2 profile.');
    await rm(join(this.root, 'runtime', 'EBWebView'), {
      recursive: true,
      force: true,
      maxRetries: 20,
      retryDelay: 100,
    });
  }
  async log(): Promise<string> {
    return readFile(join(this.root, 'runtime', 'logs', 'anehalo.log'), 'utf8');
  }
  async setVaultReadOnly(readOnly: boolean) {
    await executeFile(
      'powershell.exe',
      [
        '-NoProfile',
        '-File',
        resolve('e2e/support/vault-access.ps1'),
        '-Directory',
        this.vault,
        ...(readOnly ? ['-DenyWrite'] : []),
      ],
      { windowsHide: true },
    );
  }
}
