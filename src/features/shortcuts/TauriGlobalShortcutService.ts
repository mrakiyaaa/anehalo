import { register, unregister } from '@tauri-apps/plugin-global-shortcut';
import { failure, success, type RepositoryResult } from '@/features/storage/repository-result';
import {
  shortcutConflictMessage,
  shortcutFromEvent,
  validateShortcut,
} from './shortcut-validation';
import { isTypingInDiagramText } from './typing-target';
import { runtimePaths } from '@/app/runtime-paths';
import type {
  GlobalShortcutAction,
  GlobalShortcutService,
  ShortcutRegistration,
} from './GlobalShortcutService';

export class TauriGlobalShortcutService implements GlobalShortcutService {
  private registrations = new Map<GlobalShortcutAction, ShortcutRegistration>();
  private queue: Promise<unknown> = Promise.resolve();
  private listeningInWindow = false;

  /**
   * Isolated (test) runs must not take system-wide hotkeys from the user's own Anehalo, so
   * their shortcuts work only while the window has focus, with the same rules as global ones.
   */
  private listenInWindow() {
    if (this.listeningInWindow) return;
    this.listeningInWindow = true;
    window.addEventListener('keydown', (event) => {
      if (event.repeat || isTypingInDiagramText(event.target)) return;
      if (event.target instanceof HTMLElement && event.target.matches('[data-shortcut-recorder]'))
        return;
      const pressed = shortcutFromEvent(event);
      for (const registration of this.registrations.values())
        if (registration.shortcut === pressed) {
          event.preventDefault();
          registration.pressed();
        }
    });
  }

  replace(
    shortcut: string,
    pressed: () => void,
    action: GlobalShortcutAction = 'quick-note',
  ): Promise<RepositoryResult<void>> {
    const task = this.queue.then(async () => {
      const validated = validateShortcut(shortcut);
      if (!validated.ok) return validated;
      const current = this.registrations.get(action);
      if (
        [...this.registrations].some(
          ([registeredAction, registration]) =>
            registeredAction !== action && registration.shortcut === validated.value,
        )
      )
        return failure({
          code: 'conflict',
          message: shortcutConflictMessage,
        });
      if (current?.shortcut === validated.value) {
        current.pressed = pressed;
        return success(undefined);
      }
      try {
        if ((await runtimePaths()).isolated) {
          this.registrations.set(action, { shortcut: validated.value, pressed });
          this.listenInWindow();
          return success(undefined);
        }
        let held = false;
        await register(validated.value, (event) => {
          if (event.state === 'Released') held = false;
          else if (!held) {
            held = true;
            this.registrations.get(action)?.pressed();
          }
        });
      } catch (error) {
        return failure({
          code: 'conflict',
          message: `Could not register ${validated.value}. Another app may be using it. Open Settings → Shortcuts to choose another.`,
          detail: String(error),
        });
      }
      if (current) {
        try {
          await unregister(current.shortcut);
        } catch (error) {
          try {
            await unregister(validated.value);
          } catch (cleanupError) {
            return failure({
              code: 'io-error',
              message:
                'Could not release either shortcut. Restart Anehalo before changing it again.',
              detail: `${String(error)}; ${String(cleanupError)}`,
            });
          }
          return failure({
            code: 'io-error',
            message:
              'Could not release the previous shortcut. Your previous shortcut remains active.',
            detail: String(error),
          });
        }
      }
      this.registrations.set(action, { shortcut: validated.value, pressed });
      return success(undefined);
    });
    this.queue = task;
    return task;
  }
  unregister(
    pressed?: () => void,
    action: GlobalShortcutAction = 'quick-note',
  ): Promise<RepositoryResult<void>> {
    const task = this.queue.then(async () => {
      const current = this.registrations.get(action);
      if (!current || (pressed && pressed !== current.pressed)) return success(undefined);
      try {
        if (!(await runtimePaths()).isolated) await unregister(current.shortcut);
        this.registrations.delete(action);
        return success(undefined);
      } catch (error) {
        return failure({
          code: 'io-error',
          message: 'Could not release the global shortcut.',
          detail: String(error),
        });
      }
    });
    this.queue = task;
    return task;
  }
}
