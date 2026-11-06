import { getCurrentWindow } from '@tauri-apps/api/window';
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
  async observe(events: TrayEvents): Promise<RepositoryResult<() => void>> {
    const disposers: (() => void)[] = [];
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
        }),
      );
      return success(() => {
        for (const dispose of disposers) dispose();
      });
    } catch (error) {
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
  quit() {
    return nativeAction(() => getCurrentWindow().destroy(), 'Could not quit Anehalo.');
  }
  setAutostart(enabled: boolean) {
    return nativeAction(async () => {
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
