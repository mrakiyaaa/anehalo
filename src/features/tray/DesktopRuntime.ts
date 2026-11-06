import { createStore } from 'zustand/vanilla';
import type { WorkspaceStore } from '@/store/workspace-store';
import type { SettingsStore } from '@/features/settings/settings-store';
import type { AppSettings } from '@/features/settings/AppSettings';
import type { GlobalShortcutService } from '@/features/shortcuts/GlobalShortcutService';
import type { TrayService } from './TrayService';
import {
  success,
  failure,
  type RepositoryError,
  type RepositoryResult,
} from '@/features/storage/repository-result';
import { validateShortcut } from '@/features/shortcuts/shortcut-validation';

export class DesktopRuntime {
  readonly state = createStore<{
    settingsOpen: boolean;
    error: RepositoryError | null;
    toast: string | null;
    recordingShortcut: boolean;
  }>(() => ({ settingsOpen: false, error: null, toast: null, recordingShortcut: false }));
  private disconnect: (() => void) | undefined;
  private lifecycle: Promise<void> = Promise.resolve();
  private closing = false;
  private readonly shortcutPressed = () => {
    if (!this.state.getState().recordingShortcut) void this.quickNote();
  };
  private changes: Promise<unknown> = Promise.resolve();
  constructor(
    private readonly workspace: WorkspaceStore,
    private readonly settings: SettingsStore,
    private readonly shortcuts: GlobalShortcutService,
    private readonly tray: TrayService,
  ) {}

  private report(result: RepositoryResult<unknown>) {
    if (!result.ok) this.state.setState({ error: result.error });
  }
  openSettings(open = true) {
    this.state.setState({ settingsOpen: open });
  }
  clearNotice() {
    this.state.setState({ error: null, toast: null });
  }
  connect() {
    this.lifecycle = this.lifecycle.then(async () => {
      const observed = await this.tray.observe({
        close: () => {
          void this.close(false);
        },
        quit: () => {
          void this.close(true);
        },
        quickNote: () => {
          void this.quickNote();
        },
        settings: () => {
          this.openSettings();
        },
        focus: () => {
          void this.refresh();
        },
      });
      if (observed.ok) this.disconnect = observed.value;
      else this.report(observed);
      const settings = this.settings.getState().settings;
      if (settings) {
        this.report(await this.shortcuts.replace(settings.quickNoteShortcut, this.shortcutPressed));
        this.report(await this.tray.setAutostart(settings.startWithWindows));
      }
    });
  }
  stop() {
    this.lifecycle = this.lifecycle.then(async () => {
      this.disconnect?.();
      this.disconnect = undefined;
      this.report(await this.shortcuts.unregister(this.shortcutPressed));
    });
    return this.lifecycle;
  }
  async refresh() {
    const state = this.workspace.getState();
    this.report(await state.checkOpenNote());
    this.report(await state.refreshTree());
  }
  async quickNote(): Promise<RepositoryResult<void>> {
    const shown = await this.tray.show();
    if (!shown.ok) {
      this.report(shown);
      return shown;
    }
    this.openSettings(false);
    this.workspace.getState().setSearchOpen(false);
    const created = await this.workspace.getState().startQuickNote();
    this.report(created);
    if (!created.ok) return created;
    this.tray.focusEditor();
    return success(undefined);
  }
  updateSettings(patch: Partial<AppSettings>): Promise<RepositoryResult<void>> {
    if (this.closing)
      return Promise.resolve(
        failure({ code: 'unavailable', message: 'Anehalo is finishing pending saves.' }),
      );
    const task = this.changes.then(() => this.applySettings(patch));
    this.changes = task;
    return task;
  }
  private async applySettings(patch: Partial<AppSettings>): Promise<RepositoryResult<void>> {
    const previous = this.settings.getState().settings;
    if (!previous) return failure({ code: 'unavailable', message: 'Settings have not loaded.' });
    if (patch.quickNoteShortcut !== undefined) {
      const validated = validateShortcut(patch.quickNoteShortcut);
      if (!validated.ok) return validated;
      patch = { ...patch, quickNoteShortcut: validated.value };
      const registered = await this.shortcuts.replace(validated.value, this.shortcutPressed);
      if (!registered.ok) return registered;
    }
    if (patch.startWithWindows !== undefined) {
      const enabled = await this.tray.setAutostart(patch.startWithWindows);
      if (!enabled.ok) {
        if (patch.quickNoteShortcut !== undefined)
          this.report(
            await this.shortcuts.replace(previous.quickNoteShortcut, this.shortcutPressed),
          );
        return enabled;
      }
    }
    const saved = await this.settings.getState().update(patch);
    if (!saved.ok) {
      this.settings.getState().revertPending(Object.keys(patch) as (keyof AppSettings)[]);
      if (patch.quickNoteShortcut !== undefined)
        this.report(await this.shortcuts.replace(previous.quickNoteShortcut, this.shortcutPressed));
      if (patch.startWithWindows !== undefined)
        this.report(await this.tray.setAutostart(previous.startWithWindows));
      return saved;
    }
    this.state.setState({ error: null });
    return success(undefined);
  }
  async close(forceQuit: boolean): Promise<RepositoryResult<void>> {
    if (this.closing) return success(undefined);
    this.closing = true;
    const workspace = this.workspace.getState();
    workspace.setClosing(true);
    try {
      await this.changes;
      const notes = await workspace.flushNotes();
      if (!notes.ok) {
        this.report(notes);
        await this.tray.show().then((result) => this.report(result));
        return notes;
      }
      const settingsSaved = await this.settings.getState().flushPendingSaves();
      if (!settingsSaved.ok) {
        this.report(settingsSaved);
        this.report(await this.tray.show());
        return settingsSaved;
      }
      const finalNotes = await workspace.flushNotes();
      if (!finalNotes.ok) {
        this.report(finalNotes);
        this.report(await this.tray.show());
        return finalNotes;
      }
      const settings = this.settings.getState().settings;
      if (!forceQuit && settings?.keepRunningInTray) {
        if (!settings.trayNoticeShown) {
          const marked = await this.settings.getState().update({ trayNoticeShown: true });
          if (!marked.ok) {
            this.report(marked);
            return marked;
          }
          this.state.setState({
            toast: `Anehalo is still running in the tray. Use ${settings.quickNoteShortcut} for a new note.`,
          });
        }
        const hidden = await this.tray.hide();
        this.report(hidden);
        return hidden;
      }
      const released = await this.shortcuts.unregister(this.shortcutPressed);
      if (!released.ok) {
        this.report(released);
        return released;
      }
      const quit = await this.tray.quit();
      if (!quit.ok && settings)
        this.report(await this.shortcuts.replace(settings.quickNoteShortcut, this.shortcutPressed));
      this.report(quit);
      return quit;
    } finally {
      this.closing = false;
      workspace.setClosing(false);
    }
  }
}
