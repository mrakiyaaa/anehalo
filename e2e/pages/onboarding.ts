import { expect, type Page } from '@playwright/test';

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
}
