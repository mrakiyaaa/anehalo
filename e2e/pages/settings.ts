import { expect, type Page } from '@playwright/test';
import { selectNativeFolder } from '../support/native-dialog';

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
  async chooseVault(directory: string, applicationProcessId: number) {
    await Promise.all([
      selectNativeFolder(applicationProcessId, directory),
      this.page.getByRole('button', { name: 'Change', exact: true }).click(),
    ]);
  }
  async confirmVault(path: string) {
    const confirmation = this.page.getByRole('alertdialog', { name: 'Switch notes folder?' });
    await expect(confirmation).toContainText(`Your notes will be saved in ${path}`);
    await confirmation.getByRole('button', { name: 'Switch folder', exact: true }).click();
    await expect(confirmation).toBeHidden();
  }
}
