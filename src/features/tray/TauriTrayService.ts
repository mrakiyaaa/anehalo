import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import { runtimePaths } from '@/app/runtime-paths';
import { listen } from '@tauri-apps/api/event';
import { enable, disable, isEnabled } from '@tauri-apps/plugin-autostart';
import {
  describeStorageError,
  failure,
  success,
  type RepositoryResult,
} from '@/features/storage/repository-result';
import type { TrayEvents, TrayService } from './TrayService';

async function nativeAction(
  action: () => Promise<unknown>,
  message: string,
): Promise<RepositoryResult<void>> {
  try {
    await action();
    return success(undefined);
  } catch (error) {
    return failure({ ...describeStorageError(error, message), message, detail: String(error) });
  }
}

export class TauriTrayService implements TrayService {
  private argumentDeliveries = Promise.resolve();
  private pendingArguments: string[][] = [];
  private argumentReceiver: Pick<TrayEvents, 'arguments' | 'error'> | undefined;

  async observe(events: TrayEvents): Promise<RepositoryResult<() => void>> {
    const disposers: (() => void)[] = [];
    let disposed = false;
    const receiver = events.arguments
      ? { arguments: events.arguments, error: events.error }
      : undefined;
    if (receiver) this.argumentReceiver = receiver;
    const deliverArguments = () => {
      if (disposed) return;
      if (!events.arguments) {
        events.open();
        return;
      }
      this.argumentDeliveries = this.argumentDeliveries.then(async () => {
        try {
          const pending = await invoke<string[][]>('take_pending_arguments');
          this.pendingArguments.push(...pending);
          while (this.argumentReceiver?.arguments && this.pendingArguments.length) {
            const activeReceiver = this.argumentReceiver;
            const launchArguments = this.pendingArguments.shift();
            if (!launchArguments || !activeReceiver.arguments) break;
            const handled = await activeReceiver.arguments(launchArguments);
            if (!handled.ok) activeReceiver.error(handled.error);
          }
        } catch (error) {
          (this.argumentReceiver ?? events).error(
            describeStorageError(error, 'Could not receive the launch action.'),
          );
        }
      });
    };
    try {
      const window = getCurrentWindow();
      disposers.push(
        await window.onCloseRequested((event) => {
          event.preventDefault();
          events.close();
        }),
      );
      disposers.push(
        await window.onFocusChanged(({ payload }) => {
          if (payload) events.focus();
        }),
      );
      disposers.push(
        await listen<string>('anehalo:tray', ({ payload }) => {
          if (payload === 'quit') events.quit();
          else if (payload === 'quick-note') events.quickNote();
          else if (payload === 'settings') events.settings();
          else if (payload === 'open') events.open();
          else if (payload === 'toggle') events.toggle();
        }),
      );
      disposers.push(await listen('anehalo:arguments', deliverArguments));
      if (events.arguments) deliverArguments();
      return success(() => {
        disposed = true;
        if (this.argumentReceiver === receiver) this.argumentReceiver = undefined;
        for (const dispose of disposers) dispose();
      });
    } catch (error) {
      disposed = true;
      if (this.argumentReceiver === receiver) this.argumentReceiver = undefined;
      for (const dispose of disposers) dispose();
      return failure(describeStorageError(error, 'Could not connect to the system tray.'));
    }
  }
  show() {
    return nativeAction(async () => {
      const window = getCurrentWindow();
      await window.show();
      await window.unminimize();
      await window.setFocus();
    }, 'Could not restore the Anehalo window.');
  }
  hide() {
    return nativeAction(() => getCurrentWindow().hide(), 'Could not hide the window to the tray.');
  }
  minimize() {
    return nativeAction(() => getCurrentWindow().minimize(), 'Could not minimize Anehalo.');
  }
  async windowState() {
    try {
      const window = getCurrentWindow();
      const [visible, minimized, focused] = await Promise.all([
        window.isVisible(),
        window.isMinimized(),
        window.isFocused(),
      ]);
      return success({ visible, minimized, focused });
    } catch (error) {
      return failure(describeStorageError(error, 'Could not read the Anehalo window state.'));
    }
  }
  async initialArguments() {
    try {
      return success(await invoke<string[]>('initial_arguments'));
    } catch (error) {
      return failure(describeStorageError(error, 'Could not read the launch action.'));
    }
  }
  quit() {
    return nativeAction(() => getCurrentWindow().destroy(), 'Could not quit Anehalo.');
  }
  setAutostart(enabled: boolean) {
    return nativeAction(async () => {
      if ((await runtimePaths()).isolated) return;
      if ((await isEnabled()) !== enabled) await (enabled ? enable() : disable());
    }, 'Could not change Start with Windows.');
  }
  focusEditor() {
    const focus = () => document.querySelector<HTMLElement>('.note-prose[contenteditable="true"]');
    const existing = focus();
    if (existing) {
      existing.focus();
      return;
    }
    const observer = new MutationObserver(() => {
      const editor = focus();
      if (editor) {
        editor.focus();
        observer.disconnect();
        clearTimeout(timeout);
      }
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['contenteditable'],
    });
    const timeout = setTimeout(() => observer.disconnect(), 10000);
  }
}
