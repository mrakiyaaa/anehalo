import { expect, type Page } from '@playwright/test';

export class Diagram {
  constructor(private readonly page: Page) {}
  get container() {
    return this.page.locator('.excalidraw');
  }
  private get canvas() {
    return this.page.locator('.excalidraw__canvas.interactive');
  }
  async open() {
    await this.page.getByRole('button', { name: 'Diagram (preview)', exact: true }).click();
    await expect(this.canvas).toBeVisible({ timeout: 30_000 });
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
