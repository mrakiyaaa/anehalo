import type { AppSettings } from '@/features/settings/AppSettings';
import type { GlobalShortcutService, GlobalShortcutAction } from './GlobalShortcutService';
import { validateShortcut, shortcutConflictMessage } from './shortcut-validation';
import { failure, success, type RepositoryResult } from '@/features/storage/repository-result';

export type ShortcutSettings = Pick<
  AppSettings,
  'quickNoteShortcut' | 'newDiagramShortcut' | 'openShortcut'
>;

export class DesktopShortcutController {
  constructor(
    private readonly service: GlobalShortcutService,
    private readonly callbacks: Record<GlobalShortcutAction, () => void>,
  ) {}

  async configure(settings: ShortcutSettings): Promise<RepositoryResult<ShortcutSettings>> {
    const quickNote = validateShortcut(settings.quickNoteShortcut);
    if (!quickNote.ok) return quickNote;
    const newDiagram = validateShortcut(settings.newDiagramShortcut);
    if (!newDiagram.ok) return newDiagram;
    const open = validateShortcut(settings.openShortcut);
    if (!open.ok) return open;
    const shortcuts: Record<GlobalShortcutAction, string> = {
      'quick-note': quickNote.value,
      'new-diagram': newDiagram.value,
      open: open.value,
    };
    const values = Object.values(shortcuts);
    if (new Set(values).size !== values.length)
      return failure({ code: 'conflict', message: shortcutConflictMessage });
    for (const [action, shortcut] of Object.entries(shortcuts) as [
      GlobalShortcutAction,
      string,
    ][]) {
      const registered = await this.service.replace(shortcut, this.callbacks[action], action);
      if (!registered.ok) return registered;
    }
    return success({
      quickNoteShortcut: quickNote.value,
      newDiagramShortcut: newDiagram.value,
      openShortcut: open.value,
    });
  }

  async unregister(): Promise<RepositoryResult<void>> {
    let result: RepositoryResult<void> = success(undefined);
    for (const [action, pressed] of Object.entries(this.callbacks) as [
      GlobalShortcutAction,
      () => void,
    ][]) {
      const released = await this.service.unregister(pressed, action);
      if (result.ok) result = released;
    }
    return result;
  }
}
