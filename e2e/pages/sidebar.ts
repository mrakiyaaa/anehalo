import { expect, type Page } from '@playwright/test';

export class Sidebar {
  constructor(private readonly page: Page) {}
  private get sidebar() {
    return this.page.getByRole('complementary', { name: 'Sidebar' });
  }
  async ready(timeout = 10_000) {
    await expect(this.sidebar.getByRole('button', { name: 'Quick note', exact: true })).toBeEnabled(
      { timeout },
    );
  }
  async createFolder(name: string) {
    await this.sidebar.getByRole('button', { name: 'New folder', exact: true }).click();
    await this.sidebar.getByRole('textbox', { name: 'Folder name' }).fill(name);
    await this.sidebar.getByRole('button', { name: 'Save name' }).click();
    await this.selectFolder(name);
  }
  async selectFolder(name: string) {
    await this.sidebar
      .getByRole('navigation', { name: 'Folders' })
      .getByRole('button', { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')},`) })
      .click();
  }
  async createNote() {
    await this.sidebar.getByRole('button', { name: 'Quick note', exact: true }).click();
  }
  async openNote(title: string) {
    await this.sidebar
      .getByRole('navigation', { name: 'Notes', exact: true })
      .getByRole('button', { name: title, exact: true })
      .click();
  }
  async rename(kind: 'note' | 'folder', name: string, nextName: string) {
    const navigation = this.sidebar.getByRole('navigation', {
      name: kind === 'note' ? 'Notes' : 'Folders',
      exact: true,
    });
    await navigation.getByRole('button', { name: `Actions for ${name}`, exact: true }).click();
    await this.page.getByRole('menuitem', { name: 'Rename', exact: true }).click();
    const dialog = this.page.getByRole('dialog', { name: `Rename ${kind}` });
    await dialog.getByRole('textbox').fill(nextName);
    await dialog.getByRole('button', { name: 'Save name' }).click();
    await expect(dialog).toBeHidden();
  }
  async delete(kind: 'note' | 'folder', name: string) {
    const navigation = this.sidebar.getByRole('navigation', {
      name: kind === 'note' ? 'Notes' : 'Folders',
      exact: true,
    });
    await navigation.getByRole('button', { name: `Actions for ${name}`, exact: true }).click();
    await this.page.getByRole('menuitem', { name: 'Move to trash', exact: true }).click();
    const dialog = this.page.getByRole('alertdialog');
    await dialog.getByRole('button', { name: 'Move to trash', exact: true }).click();
    await expect(dialog).toBeHidden();
  }
}
