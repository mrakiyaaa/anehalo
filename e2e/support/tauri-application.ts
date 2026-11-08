import { spawn, execFile, type ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import { once } from 'node:events';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { chromium, expect, type Browser, type Page } from '@playwright/test';
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
    return join(this.root, 'vault');
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
    try {
      await fetch('http://127.0.0.1:9222/json/version', { signal: AbortSignal.timeout(300) });
      throw new Error('CDP port 9222 is occupied. Close the other debugging session first.');
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('CDP port')) throw error;
    }
    const started = performance.now();
    this.startedEpoch = Date.now();
    this.process = spawn(resolve('src-tauri/target/qa/debug/anehalo.exe'), launchArguments, {
      env: {
        ...process.env,
        ANEHALO_TEST_ROOT: this.root,
        WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: '--remote-debugging-port=9222',
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
    await expect
      .poll(
        async () => {
          if (launchError) throw launchError;
          if (this.process?.exitCode !== null)
            throw new Error(`The Tauri process exited before CDP connected: ${this.nativeOutput}`);
          try {
            const response = await fetch('http://127.0.0.1:9222/json/version');
            return response.ok;
          } catch {
            return false;
          }
        },
        { timeout: 20_000, intervals: [20, 50, 100] },
      )
      .toBe(true);
    this.browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
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
