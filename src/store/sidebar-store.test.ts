import { describe, expect, it } from 'vitest';
import { createSidebarStore, SIDEBAR_STORAGE_KEY, shouldCollapse } from './sidebar-store';

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    storage: () => ({
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
    }),
  };
}

describe('sidebar collapse', () => {
  it('starts from the mirrored preference, so the first frame is already right', () => {
    const { storage } = memoryStorage({ [SIDEBAR_STORAGE_KEY]: 'true' });
    expect(shouldCollapse(createSidebarStore(storage).getState())).toBe(true);
    expect(shouldCollapse(createSidebarStore(memoryStorage().storage).getState())).toBe(false);
  });

  it('collapses in a narrow window without changing the saved preference', () => {
    const { storage, values } = memoryStorage();
    const store = createSidebarStore(storage);
    store.getState().setNarrowWindow(true);
    expect(shouldCollapse(store.getState())).toBe(true);
    expect(store.getState().collapsedPreference).toBe(false);
    expect(values.has(SIDEBAR_STORAGE_KEY)).toBe(false);
    store.getState().setNarrowWindow(false);
    expect(shouldCollapse(store.getState())).toBe(false);
  });

  it('toggles the preference with animation, and expands a narrow-window collapse', () => {
    const { storage, values } = memoryStorage();
    const store = createSidebarStore(storage);
    store.getState().toggle();
    expect(store.getState()).toMatchObject({ collapsedPreference: true, animate: true });
    expect(values.get(SIDEBAR_STORAGE_KEY)).toBe('true');

    store.getState().toggle();
    store.getState().setNarrowWindow(true);
    store.getState().toggle();
    expect(shouldCollapse(store.getState())).toBe(false);
  });

  it('restores a saved state without animation', () => {
    const store = createSidebarStore(memoryStorage().storage);
    store.getState().restore(true);
    expect(store.getState()).toMatchObject({ collapsedPreference: true, animate: false });
  });
});
