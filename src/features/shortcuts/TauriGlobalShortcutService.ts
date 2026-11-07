import { register, unregister } from '@tauri-apps/plugin-global-shortcut';
import { failure, success, type RepositoryResult } from '@/features/storage/repository-result';
import { validateShortcut } from './shortcut-validation';
import { runtimePaths } from '@/app/runtime-paths';
import type { GlobalShortcutService } from './GlobalShortcutService';

export class TauriGlobalShortcutService implements GlobalShortcutService {
  private current: string | null = null;
  private pressed: (() => void) | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  replace(shortcut: string, pressed: () => void): Promise<RepositoryResult<void>> {
    const task = this.queue.then(async () => {
      const validated = validateShortcut(shortcut);
      if (!validated.ok) return validated;
      if (this.current === validated.value) {
        this.pressed = pressed;
        return success(undefined);
      }
      try {
        if ((await runtimePaths()).isolated) {
          this.current = validated.value;
          this.pressed = pressed;
          return success(undefined);
        }
        let held = false;
        await register(validated.value, (event) => {
          if (event.state === 'Released') held = false;
          else if (!held) {
            held = true;
            this.pressed?.();
          }
        });
      } catch (error) {
        return failure({
          code: 'conflict',
          message: `Could not register ${validated.value}. Another app may be using it. Open Settings → Shortcuts to choose another.`,
          detail: String(error),
        });
      }
      if (this.current) {
        try {
          await unregister(this.current);
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
      this.current = validated.value;
      this.pressed = pressed;
      return success(undefined);
    });
    this.queue = task;
    return task;
  }
  unregister(pressed?: () => void): Promise<RepositoryResult<void>> {
    const task = this.queue.then(async () => {
      if (!this.current || (pressed && pressed !== this.pressed)) return success(undefined);
      try {
        if (!(await runtimePaths()).isolated) await unregister(this.current);
        this.current = null;
        this.pressed = null;
        return success(undefined);
      } catch (error) {
        return failure({
          code: 'io-error',
          message: 'Could not release the quick-note shortcut.',
          detail: String(error),
        });
      }
    });
    this.queue = task;
    return task;
  }
}
