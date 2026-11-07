import { expect, type Page } from '@playwright/test';

export class SearchPalette {
  constructor(private readonly page: Page) {}
  async open() {
    await this.page.keyboard.press('Control+k');
  }
  async query(text: string) {
    await this.page.getByRole('combobox', { name: 'Search all notes' }).fill(text);
  }
  async expectResult(title: string) {
    await expect(this.page.getByRole('listbox', { name: 'Notes' })).toHaveAttribute(
      'aria-busy',
      'false',
    );
    await expect(this.page.getByRole('option').filter({ hasText: title })).toBeVisible();
  }
  async measureQuery(text: string): Promise<number> {
    await this.page.evaluate(() => {
      const input = document.querySelector<HTMLInputElement>('[aria-label="Search all notes"]');
      const results = document.getElementById('search-results');
      if (!input || !results) throw new Error('Search is not open.');
      input.addEventListener(
        'input',
        () => {
          const started = performance.now();
          const observer = new MutationObserver(() => {
            if (results.getAttribute('aria-busy') === 'false') {
              results.dataset.latency = String(performance.now() - started);
              observer.disconnect();
            }
          });
          observer.observe(results, { attributes: true, attributeFilter: ['aria-busy'] });
        },
        { once: true },
      );
      delete results.dataset.latency;
    });
    await this.query(text);
    const results = this.page.getByRole('listbox', { name: 'Notes' });
    await expect(results).toHaveAttribute('data-latency', /\d/);
    return Number(await results.getAttribute('data-latency'));
  }
  async choose(title: string) {
    await this.page.getByRole('option').filter({ hasText: title }).click();
  }
  async close() {
    await this.page.keyboard.press('Escape');
    await expect(this.page.getByRole('dialog', { name: 'Search notes' })).toBeHidden();
  }
}
