import { expect, type Page } from '@playwright/test';

export class Diagram {
  constructor(private readonly page: Page) {}
  get container() {
    return this.page.locator('.excalidraw');
  }
  private get canvas() {
    return this.page.locator('.excalidraw__canvas.interactive');
  }
  private get playground() {
    return this.page.getByRole('main', { name: 'Diagram', exact: true });
  }
  async openPlayground() {
    await this.page.getByRole('button', { name: 'Diagram (preview)', exact: true }).click();
    await expect(this.playground.getByRole('button', { name: 'New diagram' })).toBeVisible();
  }
  private async canvasReady() {
    await expect(this.canvas).toBeVisible({ timeout: 30_000 });
    await expect(this.playground).toHaveAttribute('aria-busy', 'false');
  }
  /** Opens the playground with a new, saved diagram. */
  async open() {
    await this.openPlayground();
    await this.playground.getByRole('button', { name: 'New diagram' }).click();
    await this.canvasReady();
  }
  async openFromVault(relativePath: string) {
    await this.playground
      .getByRole('combobox', { name: 'Open diagram' })
      .selectOption(relativePath);
  }
  async openedFromVault(relativePath: string) {
    await this.openFromVault(relativePath);
    await this.canvasReady();
  }
  async saved() {
    await expect(
      this.playground.getByRole('status').filter({ hasText: 'Saved just now' }),
    ).toBeVisible();
  }
  async expectElementCount(count: number) {
    await expect(this.playground.getByText(`${count} elements`, { exact: true })).toBeVisible();
  }
  async elementCount(): Promise<number> {
    const text = await this.playground.locator('.diagram-element-count').innerText();
    return Number.parseInt(text, 10);
  }
  alert() {
    return this.playground.getByRole('alert');
  }
  async keepMine() {
    await this.playground.getByRole('button', { name: 'Keep mine' }).click();
  }
  async delete() {
    await this.playground.getByRole('button', { name: 'Delete diagram' }).click();
    await expect(
      this.playground.getByText('Create a diagram or open one from the vault.'),
    ).toBeVisible();
  }
  private async dragAcrossCanvas() {
    const bounds = await this.canvas.boundingBox();
    if (!bounds) throw new Error('The diagram canvas has no size.');
    const left = bounds.x + bounds.width / 3;
    const top = bounds.y + bounds.height / 3;
    await this.page.mouse.move(left, top);
    await this.page.mouse.down();
    await this.page.mouse.move(left + 160, top + 100, { steps: 8 });
    await this.page.mouse.up();
  }
  /** Tools are radio inputs covered by their icon, so click the label around them. */
  private async chooseTool(testId: string) {
    await this.page.locator(`label:has([data-testid="${testId}"])`).click();
  }
  /** Selects the selection tool and clicks an empty spot, as a user does before pasting. */
  async focusCanvas() {
    await this.chooseTool('toolbar-selection');
    const bounds = await this.canvas.boundingBox();
    if (!bounds) throw new Error('The diagram canvas has no size.');
    await this.page.mouse.click(bounds.x + bounds.width * 0.85, bounds.y + bounds.height * 0.85);
  }
  async drawRectangle() {
    await this.chooseTool('toolbar-rectangle');
    await this.dragAcrossCanvas();
  }
  async writeText(text: string) {
    await this.chooseTool('toolbar-text');
    const bounds = await this.canvas.boundingBox();
    if (!bounds) throw new Error('The diagram canvas has no size.');
    await this.page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height * 0.7);
    await this.page.keyboard.type(text);
    await this.page.keyboard.press('Escape');
  }
  async openMainMenu() {
    await this.page.getByTestId('main-menu-trigger').click();
    return this.page.locator('.excalidraw .dropdown-menu');
  }
  async openMoreTools() {
    await this.container.getByTitle('More tools', { exact: true }).click();
    return this.page.locator('.excalidraw .dropdown-menu');
  }
  async openLibrary() {
    await this.container.locator('.sidebar-trigger').click();
    return this.container.locator('.layer-ui__library, .sidebar').first();
  }
  async closeMenus() {
    await this.page.keyboard.press('Escape');
  }
}
