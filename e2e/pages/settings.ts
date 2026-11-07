import { expect, type Page } from '@playwright/test';

export class Settings {
  constructor(private readonly page: Page) {}
  async open() {
    await this.page.getByRole('button', { name: 'Settings', exact: true }).click();
  }
  async theme(theme: 'light' | 'dark') {
    await this.page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption(theme);
    await this.expectTheme(theme);
  }
  async expectTheme(theme: 'light' | 'dark') {
    await expect(this.page.locator('html')).toHaveAttribute('data-theme', theme);
  }
  async disableTray() {
    await this.page
      .getByRole('checkbox', { name: 'Keep running in the tray when I close the window' })
      .uncheck();
  }
  async close() {
    await this.page.getByRole('button', { name: 'Close Settings' }).click();
    await expect(this.page.getByRole('dialog', { name: 'Settings', exact: true })).toBeHidden();
  }
}
