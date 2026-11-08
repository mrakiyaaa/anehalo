import { expect, type Page } from '@playwright/test';
import { selectNativeFolder } from '../support/native-dialog';

export class Onboarding {
  constructor(private readonly page: Page) {}
  async skip() {
    await this.page.getByRole('button', { name: 'Skip setup' }).click();
    await expect(this.page.getByText('Setup skipped.', { exact: false })).toBeVisible();
    await this.page.getByRole('button', { name: 'Open Anehalo' }).click();
  }
  async finish(name: string) {
    await this.page.getByRole('button', { name: 'Get started' }).click();
    await this.page.getByRole('textbox', { name: 'First name' }).fill(name);
    await this.page.getByRole('button', { name: 'Next', exact: true }).click();
    await this.page.getByRole('button', { name: 'Next', exact: true }).click();
    await this.page.getByRole('button', { name: 'Next', exact: true }).click();
    await this.page.getByRole('button', { name: 'Start writing' }).click();
    await this.page.getByRole('button', { name: 'Open Anehalo' }).click();
  }
  async chooseLocation(directory: string, applicationProcessId: number) {
    await this.page.getByRole('button', { name: 'Get started' }).click();
    await this.page.getByRole('button', { name: 'Next', exact: true }).click();
    await Promise.all([
      selectNativeFolder(applicationProcessId, directory),
      this.page.getByRole('button', { name: 'Browse…' }).click(),
    ]);
  }
  async expectFinalPath(path: string) {
    await expect(this.page.getByText(/Your notes will be saved in/)).toContainText(path);
  }
  async finishLocation() {
    await this.page.getByRole('button', { name: 'Next', exact: true }).click();
    await this.page.getByRole('button', { name: 'Next', exact: true }).click();
    await this.page.getByRole('button', { name: 'Start writing' }).click();
    await this.page.getByRole('button', { name: 'Open Anehalo' }).click();
  }
}
