import { spawn, execFile, type ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import { once } from 'node:events';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { chromium, type Browser, type Page } from '@playwright/test';
import { defaultSettings, type AppSettings } from '../../src/features/settings/AppSettings';

const executeFile = promisify(execFile);

export class TauriApplication {
  private process: ChildProcess | undefined;
  private browser: Browser | undefined;
  private activePage: Page | undefined;
  readonly errors: string[] = [];
  startupMilliseconds = 0;
  private startedEpoch = 0;
  private nativeOutput = '';

  constructor(readonly root: string) {}

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
    this.process = spawn(resolve('src-tauri/target/qa/debug/anehalo.exe'), launchArguments, {
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
  async usableMilliseconds(): Promise<number> {
    const usableEpoch = await this.page.evaluate(() => {
      const marker = performance.getEntriesByName('anehalo:usable')[0];
      if (!marker) throw new Error('The workspace has not committed its usable screen.');
      return performance.timeOrigin + marker.startTime;
    });
    return usableEpoch - this.startedEpoch;
  }
  async startupProfile(): Promise<unknown> {
    return this.page.evaluate(() => ({
      markers: performance
        .getEntriesByType('mark')
        .map(({ name, startTime }) => ({ name, startTime })),
      resources: performance.getEntriesByType('resource').map(({ name, startTime, duration }) => ({
        name: name.split('/').at(-1),
        startTime,
        duration,
      })),
    }));
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
