import { beforeEach, describe, expect, it } from 'vitest';
import { THEME_STORAGE_KEY } from '@/lib/constants';
import { createThemeStore } from '@/store/theme-store';

describe('theme store', () => {
  beforeEach(() => window.localStorage.clear());

  it('defaults to the system theme without saving an explicit choice', () => {
    const store = createThemeStore({ getSystemTheme: () => 'dark' });
    expect(store.getState().theme).toBe('dark');
    expect(store.getState().preference).toBeNull();
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it('toggles the effective theme and persists the choice', () => {
    const store = createThemeStore({ getSystemTheme: () => 'light' });
    store.getState().toggleTheme();
    expect(store.getState().theme).toBe('dark');
    expect(store.getState().preference).toBe('dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    store.getState().toggleTheme();
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('restores the saved choice instead of the system default', () => {
    createThemeStore().getState().setTheme('dark');
    const restartedStore = createThemeStore({ getSystemTheme: () => 'light' });
    expect(restartedStore.getState().theme).toBe('dark');
    expect(restartedStore.getState().preference).toBe('dark');
  });

  it('follows system changes until the user makes a choice', () => {
    const store = createThemeStore({ getSystemTheme: () => 'light' });
    store.getState().syncSystemTheme('dark');
    expect(store.getState().theme).toBe('dark');
    store.getState().setTheme('light');
    store.getState().syncSystemTheme('dark');
    expect(store.getState().theme).toBe('light');
  });

  it('ignores invalid persisted values', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'not-a-theme');
    const store = createThemeStore({ getSystemTheme: () => 'dark' });
    expect(store.getState().theme).toBe('dark');
    expect(store.getState().preference).toBeNull();
  });

  it('returns to the system theme when another window removes the preference', () => {
    const store = createThemeStore({ getSystemTheme: () => 'dark' });
    store.getState().setTheme('light');
    window.localStorage.removeItem(THEME_STORAGE_KEY);
    store.getState().refreshPreference();
    expect(store.getState().theme).toBe('dark');
    expect(store.getState().preference).toBeNull();
  });

  it('handles inaccessible storage and still uses the system default', () => {
    const store = createThemeStore({
      getSystemTheme: () => 'dark',
      getStorage: () => {
        throw new Error('Storage unavailable');
      },
    });
    expect(store.getState().theme).toBe('dark');
    expect(store.getState().storageError).toContain('could not be read');
  });

  it('keeps a session choice when persisting fails', () => {
    const store = createThemeStore({
      getStorage: () => ({
        getItem: () => null,
        setItem: () => {
          throw new Error('Storage full');
        },
      }),
    });
    expect(() => store.getState().setTheme('dark')).not.toThrow();
    expect(store.getState().theme).toBe('dark');
    expect(store.getState().storageError).toContain('could not be saved');
  });
});
