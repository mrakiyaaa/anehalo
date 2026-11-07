import { expect, type Page } from '@playwright/test';

export class Editor {
  constructor(private readonly page: Page) {}
  get content() {
    return this.page.getByRole('textbox', { name: 'Note content', exact: true });
  }
  get title() {
    return this.page.getByRole('textbox', { name: 'Note title', exact: true });
  }
  async ready(title: string) {
    await expect(this.title).toHaveValue(title);
    await expect(this.content).toBeEditable();
  }
  async name(title: string) {
    await this.title.fill(title);
    await this.content.click();
  }
  async type(text: string) {
    await this.content.pressSequentially(text);
  }
  async fill(text: string) {
    await this.content.fill(text);
  }
  async saved() {
    await expect(this.page.getByRole('status').filter({ hasText: 'Saved just now' })).toBeVisible();
  }
  async home() {
    await this.page.getByRole('button', { name: 'Home', exact: true }).click();
  }
  async bold(text: string) {
    await this.content.click();
    await this.page.keyboard.press('Control+b');
    await this.page.keyboard.insertText(text);
    await this.page.keyboard.press('Control+b');
  }
  async expectBold(text: string) {
    await expect(this.content.locator('strong')).toHaveText(text);
  }
  async insertPageLink(title: string) {
    await this.content.click();
    await this.content.press('Control+End');
    await this.content.press('Enter');
    await this.content.pressSequentially(`/page ${title}`);
    await this.page.getByRole('option').filter({ hasText: title }).first().click();
  }
  async openLink(title: string) {
    await this.content.getByRole('button', { name: title, exact: true }).click();
  }
  async expectBacklink(title: string) {
    await expect(
      this.page.locator('.backlinks-panel').getByRole('button').filter({ hasText: title }),
    ).toBeVisible();
  }
  async addImage(path: string) {
    await this.page.getByLabel('Choose image', { exact: true }).setInputFiles(path);
  }
  async exportMarkdown() {
    await this.page.getByRole('button', { name: 'Export', exact: true }).click();
    await this.page.getByRole('menuitem', { name: 'Save as Markdown (.md)', exact: true }).click();
  }
  async closeWindow() {
    await this.page.getByRole('button', { name: 'Close', exact: true }).click();
  }
  async expectSaveError() {
    await expect(
      this.page
        .getByRole('alert')
        .filter({ hasText: /Access was denied|Could not save/ })
        .first(),
    ).toBeVisible();
  }
  async retrySave() {
    await this.page.getByRole('button', { name: 'Retry save', exact: true }).click();
  }
  async expectMissing() {
    await expect(
      this.page.getByRole('alert').filter({ hasText: 'deleted or renamed' }).first(),
    ).toBeVisible();
  }
  async expectImageError() {
    await expect(
      this.page.getByRole('alert').filter({ hasText: 'Could not save the image' }),
    ).toBeVisible();
  }
  async checkAgain() {
    await this.page.getByRole('button', { name: 'Check again', exact: true }).click();
  }
  async append(text: string) {
    await this.content.press('Control+End');
    await this.page.keyboard.insertText(text);
  }
}
