import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test as base, expect } from '@playwright/test';
import { TauriApplication } from './support/tauri-application';
import { createTestDirectory, testDirectoryParent } from './support/test-directory';

async function removeTestRoot(root: string) {
  const temporaryParent = testDirectoryParent;
  if (!resolve(root).startsWith(`${temporaryParent}\\anehalo-e2e-`))
    throw new Error('Refusing to remove a path outside the isolated test directory.');
  await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

export const test = base.extend<{ application: TauriApplication }>({
  application: async ({ browserName }, provideApplication, testInfo) => {
    if (browserName !== 'chromium') throw new Error('WebView2 requires Chromium CDP.');
    const root = await createTestDirectory();
    const application = new TauriApplication(root);
    try {
      await provideApplication(application);
      expect(application.errors, 'No JavaScript, CSP, or resource errors').toEqual([]);
    } finally {
      if (testInfo.status !== testInfo.expectedStatus) {
        await testInfo.attach('console-errors', {
          body: JSON.stringify(application.errors),
          contentType: 'application/json',
        });
        try {
          await testInfo.attach('native-log', {
            body: await application.log(),
            contentType: 'text/plain',
          });
          await testInfo.attach('screen', {
            body: await application.page.screenshot({ timeout: 2000 }),
            contentType: 'image/png',
          });
          await testInfo.attach('body', {
            body: await application.page.locator('body').innerText({ timeout: 2000 }),
            contentType: 'text/plain',
          });
        } catch (error) {
          await testInfo.attach('capture-error', {
            body: String(error),
            contentType: 'text/plain',
          });
        }
      }
      await application.stop();
      await removeTestRoot(root);
    }
  },
});
export { expect };
