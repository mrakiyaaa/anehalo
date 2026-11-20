import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultSettings } from '@/features/settings/AppSettings';
import { InMemorySettingsRepository } from '@/features/settings/InMemorySettingsRepository';
import { createSettingsStore, type SettingsStore } from '@/features/settings/settings-store';
import { useAccentStore } from '@/store/accent-store';
import { useSidebarStore } from '@/store/sidebar-store';
import { unwrapResult } from '@/test/repository-helpers';
import {
  PREFERENCE_SAVE_DELAY_MS,
  flushPreferenceSaves,
  usePreferenceNotice,
  usePreferenceSync,
} from './preference-sync';

const logFailure = vi.hoisted(() => vi.fn());
vi.mock('@/features/diagnostics/error-logging', () => ({ logFailure }));

function Sync({ store }: { store: SettingsStore }) {
  usePreferenceSync(store);
  return null;
}

async function setup(saved: Record<string, unknown> = {}) {
  const repository = new InMemorySettingsRepository(
    JSON.stringify({ ...defaultSettings('Memory/Anehalo'), onboardingCompleted: true, ...saved }),
  );
  const store = createSettingsStore(repository);
  render(<Sync store={store} />);
  await act(() => store.getState().load());
  return { repository, store };
}

beforeEach(() => {
  useAccentStore.getState().setAccent('sky');
  useSidebarStore.getState().restore(false);
});
afterEach(() => {
  vi.useRealTimers();
  usePreferenceNotice.getState().dismiss();
  logFailure.mockClear();
});

describe('preference sync', () => {
  it('applies the accent and sidebar state saved in settings.json', async () => {
    await setup({ accent: 'lilac', sidebarCollapsed: true });
    expect(useAccentStore.getState().accent).toBe('lilac');
    expect(useSidebarStore.getState()).toMatchObject({ collapsedPreference: true, animate: false });
  });

  it('saves once after a burst of choices, without waiting on the interface', async () => {
    const { repository } = await setup();
    vi.useFakeTimers();
    const save = vi.spyOn(repository, 'save');
    act(() => {
      useAccentStore.getState().setAccent('mint');
      useAccentStore.getState().setAccent('rose');
      useSidebarStore.getState().toggle();
    });
    expect(save).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(PREFERENCE_SAVE_DELAY_MS));
    expect(save).toHaveBeenCalledTimes(1);
    expect(unwrapResult(await repository.load())).toMatchObject({
      accent: 'rose',
      sidebarCollapsed: true,
    });
  });

  it('saves a pending choice at once when the app flushes before closing', async () => {
    const { repository } = await setup();
    act(() => useAccentStore.getState().setAccent('peach'));
    await act(() => flushPreferenceSaves());
    expect(unwrapResult(await repository.load()).accent).toBe('peach');
  });

  it('keeps the chosen colour, shows a notice and logs when saving fails', async () => {
    const { repository } = await setup();
    repository.file.writeError = new Error('Disk full');
    act(() => useAccentStore.getState().setAccent('butter'));
    await act(() => flushPreferenceSaves());
    expect(useAccentStore.getState().accent).toBe('butter');
    expect(document.documentElement.dataset.accent).toBe('butter');
    expect(usePreferenceNotice.getState().message).toContain('could not be saved');
    expect(logFailure).toHaveBeenCalledWith('preference-save-failed', expect.any(String));
  });
});
