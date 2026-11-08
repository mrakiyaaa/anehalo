import { failure, success } from '@/features/storage/repository-result';
import { validateShortcut, shortcutConflictMessage } from './shortcut-validation';
import type {
  GlobalShortcutAction,
  GlobalShortcutService,
  ShortcutRegistration,
} from './GlobalShortcutService';

export class FakeGlobalShortcutService implements GlobalShortcutService {
  readonly registrations = new Map<GlobalShortcutAction, ShortcutRegistration>();
  get current() {
    return this.registrations.get('quick-note')?.shortcut ?? null;
  }
  get pressed() {
    return this.registrations.get('quick-note')?.pressed ?? null;
  }
  conflicts = new Set<string>();
  replace(shortcut: string, pressed: () => void, action: GlobalShortcutAction = 'quick-note') {
    const validated = validateShortcut(shortcut);
    if (!validated.ok) return Promise.resolve(validated);
    if (
      [...this.registrations].some(
        ([registeredAction, registration]) =>
          registeredAction !== action && registration.shortcut === validated.value,
      )
    )
      return Promise.resolve(
        failure({
          code: 'conflict',
          message: shortcutConflictMessage,
        }),
      );
    if (this.conflicts.has(validated.value))
      return Promise.resolve(
        failure({
          code: 'conflict',
          message: 'Shortcut is already taken. Open Settings → Shortcuts to choose another.',
        }),
      );
    this.registrations.set(action, { shortcut: validated.value, pressed });
    return Promise.resolve(success(undefined));
  }
  unregister(pressed?: () => void, action: GlobalShortcutAction = 'quick-note') {
    if (pressed && pressed !== this.registrations.get(action)?.pressed)
      return Promise.resolve(success(undefined));
    this.registrations.delete(action);
    return Promise.resolve(success(undefined));
  }
}
