import type { TrayService } from '@/features/tray/TrayService';
import {
  describeStorageError,
  failure,
  type RepositoryResult,
} from '@/features/storage/repository-result';

interface VisibilityOptions {
  keepRunningInTray: () => boolean;
  hasOpenEditor: () => boolean;
  flushPendingSaves: () => Promise<RepositoryResult<void>>;
}

export class WindowVisibilityController {
  private pending: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly window: TrayService,
    private readonly options: VisibilityOptions,
  ) {}

  private serialize(action: () => Promise<RepositoryResult<void>>) {
    const task = this.pending.then(async () => {
      try {
        return await action();
      } catch (error) {
        return failure(describeStorageError(error, 'Could not change the Anehalo window.'));
      }
    });
    this.pending = task;
    return task;
  }

  private async restore(focusEditor: boolean) {
    const shown = await this.window.show();
    if (shown.ok && focusEditor) this.focusEditor();
    return shown;
  }

  show(focusEditor = this.options.hasOpenEditor()) {
    return this.serialize(() => this.restore(focusEditor));
  }

  focusEditor() {
    this.window.focusEditor();
  }

  private async conceal(minimize: boolean) {
    const saved = await this.options.flushPendingSaves();
    if (!saved.ok) return saved;
    return minimize ? this.window.minimize() : this.window.hide();
  }

  hide() {
    return this.serialize(() => this.conceal(false));
  }

  toggle(source: 'shortcut' | 'tray' = 'shortcut') {
    return this.serialize(async () => {
      const state = await this.window.windowState();
      if (!state.ok) return state;
      const { visible, minimized, focused } = state.value;
      if (!visible || minimized || (source === 'shortcut' && !focused))
        return this.restore(this.options.hasOpenEditor());
      return this.conceal(source === 'shortcut' && !this.options.keepRunningInTray());
    });
  }
}
