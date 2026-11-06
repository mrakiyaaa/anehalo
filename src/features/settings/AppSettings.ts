import type { Theme } from '@/types/theme';

export type ThemePreference = Theme | 'system';

export interface AppSettings {
  readonly onboardingCompleted: boolean;
  readonly userName: string;
  readonly vaultPath: string;
  readonly theme: ThemePreference;
  readonly lastOpenedNotePath: string | null;
  readonly reopenLastNote: boolean;
  readonly lastExportFolder: string | null;
  readonly quickNoteShortcut: string;
  readonly keepRunningInTray: boolean;
  readonly startWithWindows: boolean;
  readonly trayNoticeShown: boolean;
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
    lastOpenedNotePath: null,
    reopenLastNote: true,
    lastExportFolder: null,
    quickNoteShortcut: 'Ctrl+Alt+N',
    keepRunningInTray: true,
    startWithWindows: false,
    trayNoticeShown: false,
  };
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
    !('vaultPath' in value) ||
    typeof value.vaultPath !== 'string' ||
    !value.vaultPath.trim() ||
    !('theme' in value) ||
    (value.theme !== 'light' && value.theme !== 'dark' && value.theme !== 'system')
  )
    return defaults;
  return {
    onboardingCompleted: value.onboardingCompleted,
    userName: normalizeUserName(value.userName),
    vaultPath: value.vaultPath,
    theme: value.theme,
    lastOpenedNotePath:
      'lastOpenedNotePath' in value && typeof value.lastOpenedNotePath === 'string'
        ? value.lastOpenedNotePath
        : null,
    reopenLastNote:
      'reopenLastNote' in value && typeof value.reopenLastNote === 'boolean'
        ? value.reopenLastNote
        : true,
    quickNoteShortcut:
      'quickNoteShortcut' in value && typeof value.quickNoteShortcut === 'string'
        ? value.quickNoteShortcut
        : 'Ctrl+Alt+N',
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
    lastExportFolder:
      'lastExportFolder' in value &&
      typeof value.lastExportFolder === 'string' &&
      value.lastExportFolder.trim()
        ? value.lastExportFolder
        : null,
  };
}
