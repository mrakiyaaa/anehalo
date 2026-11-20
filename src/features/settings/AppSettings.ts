import type { Theme } from '@/types/theme';
import { defaultAccent, isAccentId, type AccentId } from '@/features/theme/accent-palette';
import { logFailure } from '@/features/diagnostics/error-logging';
import {
  defaultNewDiagramShortcut,
  defaultOpenShortcut,
  defaultQuickNoteShortcut,
  validateShortcut,
} from '@/features/shortcuts/shortcut-validation';

export type ThemePreference = Theme | 'system';

export interface AppSettings {
  readonly onboardingCompleted: boolean;
  readonly userName: string;
  readonly vaultPath: string;
  readonly theme: ThemePreference;
  readonly accent: AccentId;
  readonly sidebarCollapsed: boolean;
  readonly lastOpenedNotePath: string | null;
  readonly reopenLastNote: boolean;
  readonly lastExportFolder: string | null;
  readonly quickNoteShortcut: string;
  readonly openShortcut: string;
  readonly newDiagramShortcut: string;
  readonly keepRunningInTray: boolean;
  readonly startWithWindows: boolean;
  readonly trayNoticeShown: boolean;
  readonly autoCheckForUpdates: boolean;
}

export const themeLabels: Record<ThemePreference, string> = {
  light: 'Light',
  dark: 'Dark',
  system: 'Match my PC',
};

export const maximumUserNameLength = 30;

export function limitUserName(name: string): string {
  return Array.from(name).slice(0, maximumUserNameLength).join('');
}

export function normalizeUserName(name: string): string {
  return limitUserName(name.trim());
}

export function defaultSettings(vaultPath: string): AppSettings {
  return {
    onboardingCompleted: false,
    userName: '',
    vaultPath,
    theme: 'system',
    accent: defaultAccent,
    sidebarCollapsed: false,
    lastOpenedNotePath: null,
    reopenLastNote: true,
    lastExportFolder: null,
    quickNoteShortcut: defaultQuickNoteShortcut,
    openShortcut: defaultOpenShortcut,
    newDiagramShortcut: defaultNewDiagramShortcut,
    keepRunningInTray: true,
    startWithWindows: false,
    trayNoticeShown: false,
    autoCheckForUpdates: true,
  };
}

/** Settings from before accents have none and get the default; an unknown id is logged. */
function parseAccent(value: unknown): AccentId {
  if (value === undefined) return defaultAccent;
  if (isAccentId(value)) return value;
  logFailure('unknown-accent');
  return defaultAccent;
}

export function parseSettings(content: string, defaults: AppSettings): AppSettings {
  let value: unknown;
  try {
    value = JSON.parse(content);
  } catch {
    // An interrupted or manually edited settings file must not prevent startup.
    return defaults;
  }
  if (
    typeof value !== 'object' ||
    value === null ||
    !('onboardingCompleted' in value) ||
    typeof value.onboardingCompleted !== 'boolean' ||
    !('userName' in value) ||
    typeof value.userName !== 'string' ||
    !('theme' in value) ||
    (value.theme !== 'light' && value.theme !== 'dark' && value.theme !== 'system')
  )
    return defaults;
  const quickNote = validateShortcut(
    'quickNoteShortcut' in value && typeof value.quickNoteShortcut === 'string'
      ? value.quickNoteShortcut
      : defaultQuickNoteShortcut,
  );
  const quickNoteShortcut = quickNote.ok ? quickNote.value : defaultQuickNoteShortcut;
  const open = validateShortcut(
    'openShortcut' in value && typeof value.openShortcut === 'string'
      ? value.openShortcut
      : defaultOpenShortcut,
  );
  let openShortcut = open.ok ? open.value : defaultOpenShortcut;
  // Preserve a pre-existing custom quick-note binding when adding the new shortcut.
  if (openShortcut === quickNoteShortcut)
    openShortcut = quickNoteShortcut === defaultOpenShortcut ? 'Ctrl+Alt+O' : defaultOpenShortcut;
  const newDiagram = validateShortcut(
    'newDiagramShortcut' in value && typeof value.newDiagramShortcut === 'string'
      ? value.newDiagramShortcut
      : defaultNewDiagramShortcut,
  );
  const taken = [quickNoteShortcut, openShortcut];
  // Settings from before diagrams may already use Ctrl+Alt+D for another action.
  const newDiagramShortcut =
    newDiagram.ok && !taken.includes(newDiagram.value)
      ? newDiagram.value
      : ([defaultNewDiagramShortcut, 'Ctrl+Alt+Shift+D', 'Ctrl+Alt+G'].find(
          (shortcut) => !taken.includes(shortcut),
        ) ?? defaultNewDiagramShortcut);
  return {
    onboardingCompleted: value.onboardingCompleted,
    accent: parseAccent('accent' in value ? value.accent : undefined),
    sidebarCollapsed:
      'sidebarCollapsed' in value && typeof value.sidebarCollapsed === 'boolean'
        ? value.sidebarCollapsed
        : false,
    userName: normalizeUserName(value.userName),
    vaultPath: 'vaultPath' in value && typeof value.vaultPath === 'string' ? value.vaultPath : '',
    theme: value.theme,
    lastOpenedNotePath:
      'lastOpenedNotePath' in value && typeof value.lastOpenedNotePath === 'string'
        ? value.lastOpenedNotePath
        : null,
    reopenLastNote:
      'reopenLastNote' in value && typeof value.reopenLastNote === 'boolean'
        ? value.reopenLastNote
        : true,
    quickNoteShortcut,
    openShortcut,
    newDiagramShortcut,
    keepRunningInTray:
      'keepRunningInTray' in value && typeof value.keepRunningInTray === 'boolean'
        ? value.keepRunningInTray
        : true,
    startWithWindows:
      'startWithWindows' in value && typeof value.startWithWindows === 'boolean'
        ? value.startWithWindows
        : false,
    trayNoticeShown:
      'trayNoticeShown' in value && typeof value.trayNoticeShown === 'boolean'
        ? value.trayNoticeShown
        : false,
    autoCheckForUpdates:
      'autoCheckForUpdates' in value && typeof value.autoCheckForUpdates === 'boolean'
        ? value.autoCheckForUpdates
        : true,
    lastExportFolder:
      'lastExportFolder' in value &&
      typeof value.lastExportFolder === 'string' &&
      value.lastExportFolder.trim()
        ? value.lastExportFolder
        : null,
  };
}
