import { failure, success } from '@/features/storage/repository-result';
import { validateShortcut } from './shortcut-validation';
import type { GlobalShortcutService } from './GlobalShortcutService';

export class FakeGlobalShortcutService implements GlobalShortcutService {
  current: string | null = null;
  pressed: (() => void) | null = null;
  conflicts = new Set<string>();
  replace(shortcut: string, pressed: () => void) {
    const validated = validateShortcut(shortcut);
    if (!validated.ok) return Promise.resolve(validated);
    if (this.conflicts.has(validated.value))
      return Promise.resolve(
        failure({
          code: 'conflict',
          message: 'Shortcut is already taken. Open Settings → Shortcuts to choose another.',
        }),
      );
    this.current = validated.value;
    this.pressed = pressed;
    return Promise.resolve(success(undefined));
  }
  unregister(pressed?: () => void) {
    if (pressed && pressed !== this.pressed) return Promise.resolve(success(undefined));
    this.current = null;
    this.pressed = null;
    return Promise.resolve(success(undefined));
  }
}
