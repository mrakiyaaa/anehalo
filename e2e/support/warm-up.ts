import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { TauriApplication } from './tauri-application';
import { createTestDirectory, testDirectoryParent } from './test-directory';

/**
 * Starts the app once before the suite and throws the run away. The first WebView2 start on a
 * fresh CI runner, or just after the runtime updated itself, can take far longer than any later
 * one; without this it fell on whichever test ran first. Startup is still measured, from normal
 * starts, by the startup budget test.
 */
export default async function warmUpWebView2(): Promise<void> {
  if (process.platform !== 'win32') return;
  const root = await createTestDirectory();
  const application = new TauriApplication(root);
  application.devtoolsWaitMilliseconds = 120_000;
  try {
    await application.seedSettings();
    await application.start();
  } finally {
    await application.stop();
    if (resolve(root).startsWith(`${testDirectoryParent}\\anehalo-e2e-`))
      await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}
