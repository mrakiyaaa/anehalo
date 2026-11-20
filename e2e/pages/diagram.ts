import { expect, type Page } from '@playwright/test';

export class Diagram {
  constructor(private readonly page: Page) {}
  get container() {
    return this.page.locator('.excalidraw');
  }
  private get canvas() {
    return this.page.locator('.excalidraw__canvas.interactive');
  }
  /** The diagram screen, including its loading and error states. */
  get screen() {
    return this.page.getByRole('main', { name: 'Diagram', exact: true });
  }
  title() {
    return this.screen.getByRole('textbox', { name: 'Diagram title', exact: true });
  }
  /** Waits for the canvas, ready to draw on. */
  async ready() {
    await expect(this.canvas).toBeVisible({ timeout: 30_000 });
    await expect(this.screen).toHaveAttribute('aria-busy', 'false');
  }
  /** Creates a diagram with the sidebar's New diagram button and waits for its canvas. */
  async create() {
    await this.page
      .getByRole('complementary', { name: 'Sidebar' })
      .getByRole('button', { name: /^New diagram/ })
      .click();
    await this.ready();
  }
  async createFromHome() {
    await this.page
      .getByRole('main', { name: 'Workspace' })
      .getByRole('button', { name: 'New diagram', exact: true })
      .click();
    await this.ready();
  }
  async saved() {
    await expect(
      this.screen.getByRole('status').filter({ hasText: 'Saved just now' }),
    ).toBeVisible();
  }
  /** Counts drawn elements through the screen's data attribute, so the UI needs no readout. */
  async expectElementCount(count: number, timeout = 10_000) {
    await expect(this.screen).toHaveAttribute('data-element-count', String(count), { timeout });
  }
  alert() {
    return this.screen.getByRole('alert');
  }
  async keepMine() {
    await this.screen.getByRole('button', { name: 'Keep mine' }).click();
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
  /** Starts a text element and types into it, leaving Excalidraw's text editor open. */
  async startText(text: string) {
    await this.chooseTool('toolbar-text');
    const bounds = await this.canvas.boundingBox();
    if (!bounds) throw new Error('The diagram canvas has no size.');
    await this.page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height * 0.7);
    await expect(this.page.locator('textarea.excalidraw-wysiwyg')).toBeFocused();
    await this.page.keyboard.type(text);
  }
  async writeText(text: string) {
    await this.startText(text);
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
