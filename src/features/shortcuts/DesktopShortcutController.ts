import type { AppSettings } from '@/features/settings/AppSettings';
import type { GlobalShortcutService, GlobalShortcutAction } from './GlobalShortcutService';
import { validateShortcut, shortcutConflictMessage } from './shortcut-validation';
import { failure, success, type RepositoryResult } from '@/features/storage/repository-result';

type ShortcutSettings = Pick<AppSettings, 'quickNoteShortcut' | 'openShortcut'>;

export class DesktopShortcutController {
  constructor(
    private readonly service: GlobalShortcutService,
    private readonly callbacks: Record<GlobalShortcutAction, () => void>,
  ) {}

  async configure(settings: ShortcutSettings): Promise<RepositoryResult<ShortcutSettings>> {
    const quickNote = validateShortcut(settings.quickNoteShortcut);
    if (!quickNote.ok) return quickNote;
    const open = validateShortcut(settings.openShortcut);
    if (!open.ok) return open;
    if (quickNote.value === open.value)
      return failure({
        code: 'conflict',
        message: shortcutConflictMessage,
      });
    const registered = await this.service.replace(quickNote.value, this.callbacks['quick-note']);
    if (!registered.ok) return registered;
    const opened = await this.service.replace(open.value, this.callbacks.open, 'open');
    if (!opened.ok) return opened;
    return success({ quickNoteShortcut: quickNote.value, openShortcut: open.value });
  }

  async unregister(): Promise<RepositoryResult<void>> {
    const quickNote = await this.service.unregister(this.callbacks['quick-note']);
    const open = await this.service.unregister(this.callbacks.open, 'open');
    return !quickNote.ok ? quickNote : open;
  }
}
