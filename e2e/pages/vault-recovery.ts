import { expect, type Page } from '@playwright/test';

export class VaultRecovery {
  constructor(private readonly page: Page) {}
  async ready() {
    await expect(
      this.page.getByRole('heading', { name: "We couldn't open your notes folder" }),
    ).toBeVisible();
  }
  async useDefault() {
    await this.page.getByRole('button', { name: 'Use the default folder' }).click();
  }
}
