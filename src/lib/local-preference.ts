/**
 * A copy of a setting in localStorage. settings.json is read asynchronously, so the copy lets the
 * first render use the saved value (no flash); settings.json stays the source of truth.
 */
export type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function readLocalPreference(
  key: string,
  storage: () => PreferenceStorage = () => window.localStorage,
): string | null {
  try {
    return storage().getItem(key);
  } catch (error) {
    // Blocked storage only costs the startup shortcut; settings.json still applies once read.
    console.warn(`Anehalo could not read ${key} from local storage.`, error);
    return null;
  }
}

export function writeLocalPreference(
  key: string,
  value: string,
  storage: () => PreferenceStorage = () => window.localStorage,
): void {
  try {
    storage().setItem(key, value);
  } catch (error) {
    console.warn(`Anehalo could not keep ${key} in local storage.`, error);
  }
}
