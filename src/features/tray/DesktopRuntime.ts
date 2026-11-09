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
import { DesktopShortcutController } from '@/features/shortcuts/DesktopShortcutController';
import { WindowVisibilityController } from '@/features/window/WindowVisibilityController';
import { parseCommandLineArguments } from '@/features/launch/command-line-arguments';
import { DisabledUpdateService } from '@/features/updates/DisabledUpdateService';
import { UpdateController } from '@/features/updates/UpdateController';
import type { UpdateService } from '@/features/updates/UpdateService';

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
  private readonly openShortcutPressed = () => {
    if (!this.state.getState().recordingShortcut) void this.toggle();
  };
  readonly visibility: WindowVisibilityController;
  readonly updates: UpdateController;
  private readonly shortcutController: DesktopShortcutController;
  private changes: Promise<unknown> = Promise.resolve();
  private toggles: Promise<unknown> = Promise.resolve();
  constructor(
    private readonly workspace: WorkspaceStore,
    private readonly settings: SettingsStore,
    shortcuts: GlobalShortcutService,
    private readonly tray: TrayService,
    updater: UpdateService = new DisabledUpdateService(),
  ) {
    this.updates = new UpdateController(updater, {
      autoCheck: () => this.settings.getState().settings?.autoCheckForUpdates ?? true,
      flushPendingSaves: () => this.flushPendingSaves(),
      setEditingLocked: (locked) => this.workspace.getState().setClosing(locked),
    });
    this.shortcutController = new DesktopShortcutController(shortcuts, {
      'quick-note': this.shortcutPressed,
      open: this.openShortcutPressed,
    });
    this.visibility = new WindowVisibilityController(tray, {
      keepRunningInTray: () => this.settings.getState().settings?.keepRunningInTray ?? true,
      hasOpenEditor: () =>
        this.workspace.getState().view === 'editor' &&
        !this.workspace.getState().isSearchOpen &&
        !this.state.getState().settingsOpen,
      flushPendingSaves: () => this.flushPendingSaves(),
    });
  }

  private async flushPendingSaves(): Promise<RepositoryResult<void>> {
    await this.changes;
    const notes = await this.workspace.getState().flushNotes();
    if (!notes.ok) return notes;
    return this.settings.getState().flushPendingSaves();
  }

  async show(): Promise<RepositoryResult<void>> {
    const shown = await this.visibility.show();
    this.report(shown);
    return shown;
  }

  toggle(source: 'shortcut' | 'tray' = 'shortcut'): Promise<RepositoryResult<void>> {
    const task = this.toggles.then(async () => {
      if (this.closing) return success(undefined);
      this.closing = true;
      this.workspace.getState().setClosing(true);
      try {
        const toggled = await this.visibility.toggle(source);
        this.report(toggled);
        return toggled;
      } finally {
        this.closing = false;
        this.workspace.getState().setClosing(false);
      }
    });
    this.toggles = task;
    return task;
  }

  async handleArguments(launchArguments: readonly string[]): Promise<RepositoryResult<void>> {
    const parsed = parseCommandLineArguments(launchArguments);
    if (!parsed.ok) {
      await this.show();
      this.report(parsed);
      return parsed;
    }
    if (parsed.value === 'background') return success(undefined);
    await this.workspace.getState().initialize();
    return parsed.value === 'new-note' ? this.quickNote() : this.show();
  }

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
    void this.updates.start();
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
          void this.show();
        },
        focus: () => {
          void this.refresh();
        },
        open: () => {
          void this.show();
        },
        toggle: () => {
          void this.toggle('tray');
        },
        arguments: (launchArguments) => this.handleArguments(launchArguments),
        error: (error) => this.report(failure(error)),
      });
      if (observed.ok) this.disconnect = observed.value;
      else this.report(observed);
      const settings = this.settings.getState().settings;
      if (settings) {
        this.report(await this.shortcutController.configure(settings));
        this.report(await this.tray.setAutostart(settings.startWithWindows));
      }
    });
    return this.lifecycle;
  }
  stop() {
    this.updates.stop();
    this.lifecycle = this.lifecycle.then(async () => {
      this.disconnect?.();
      this.disconnect = undefined;
      this.report(await this.shortcutController.unregister());
    });
    return this.lifecycle;
  }
  async refresh() {
    const state = this.workspace.getState();
    this.report(await state.checkOpenNote());
    this.report(await state.refreshTree());
  }
  async quickNote(): Promise<RepositoryResult<void>> {
    const shown = await this.visibility.show(false);
    if (!shown.ok) {
      this.report(shown);
      return shown;
    }
    this.openSettings(false);
    this.workspace.getState().setSearchOpen(false);
    const created = await this.workspace.getState().startQuickNote();
    this.report(created);
    if (!created.ok) return created;
    this.visibility.focusEditor();
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
    const shortcutsChanged =
      patch.quickNoteShortcut !== undefined || patch.openShortcut !== undefined;
    if (shortcutsChanged) {
      const registered = await this.shortcutController.configure({ ...previous, ...patch });
      if (!registered.ok) {
        this.report(await this.shortcutController.configure(previous));
        return registered;
      }
      patch = { ...patch, ...registered.value };
    }
    if (patch.startWithWindows !== undefined) {
      const enabled = await this.tray.setAutostart(patch.startWithWindows);
      if (!enabled.ok) {
        if (shortcutsChanged) this.report(await this.shortcutController.configure(previous));
        return enabled;
      }
    }
    const saved = await this.settings.getState().update(patch);
    if (!saved.ok) {
      this.settings.getState().revertPending(Object.keys(patch) as (keyof AppSettings)[]);
      if (shortcutsChanged) this.report(await this.shortcutController.configure(previous));
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
        await this.show();
        return notes;
      }
      const settingsSaved = await this.settings.getState().flushPendingSaves();
      if (!settingsSaved.ok) {
        this.report(settingsSaved);
        await this.show();
        return settingsSaved;
      }
      const finalNotes = await workspace.flushNotes();
      if (!finalNotes.ok) {
        this.report(finalNotes);
        await this.show();
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
        const hidden = await this.visibility.hide();
        this.report(hidden);
        return hidden;
      }
      const released = await this.shortcutController.unregister();
      if (!released.ok) {
        if (settings) this.report(await this.shortcutController.configure(settings));
        this.report(released);
        return released;
      }
      const quit = await this.tray.quit();
      if (!quit.ok && settings) this.report(await this.shortcutController.configure(settings));
      this.report(quit);
      return quit;
    } finally {
      this.closing = false;
      workspace.setClosing(false);
    }
  }
}
