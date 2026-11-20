import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultSettings } from './AppSettings';
import { InMemorySettingsRepository } from './InMemorySettingsRepository';
import { createSettingsStore } from './settings-store';
import { SETTINGS_WAIT_LIMIT_MS, settingsReady } from './settings-ready';
import { failure } from '@/features/storage/repository-result';

const logFailure = vi.hoisted(() => vi.fn());
vi.mock('@/features/diagnostics/error-logging', () => ({ logFailure }));

afterEach(() => {
  vi.useRealTimers();
  logFailure.mockClear();
});

describe('waiting for settings before showing the window', () => {
  it('continues as soon as settings.json has been read', async () => {
    const store = createSettingsStore(
      new InMemorySettingsRepository(JSON.stringify(defaultSettings('Memory/Anehalo'))),
    );
    const ready = settingsReady(store);
    await store.getState().load();
    expect(await ready).toBe('loaded');
    expect(logFailure).not.toHaveBeenCalled();
  });

  it('shows the window with defaults after the limit, logs it, and applies settings later', async () => {
    vi.useFakeTimers();
    const repository = new InMemorySettingsRepository(
      JSON.stringify({ ...defaultSettings('Memory/Anehalo'), accent: 'mint' }),
    );
    let release: () => void = () => undefined;
    const slowRead = new Promise<void>((resolve) => {
      release = resolve;
    });
    const load = repository.load.bind(repository);
    vi.spyOn(repository, 'load').mockImplementation(async () => {
      await slowRead;
      return load();
    });
    const store = createSettingsStore(repository);
    const loading = store.getState().load();
    const ready = settingsReady(store);

    await vi.advanceTimersByTimeAsync(SETTINGS_WAIT_LIMIT_MS);
    expect(await ready).toBe('timed-out');
    expect(logFailure).toHaveBeenCalledWith('settings-timeout');
    expect(store.getState().settings).toBeNull();

    release();
    await loading;
    expect(store.getState().settings?.accent).toBe('mint');
  });

  it('continues when settings.json cannot be read at all', async () => {
    const repository = new InMemorySettingsRepository('{}');
    vi.spyOn(repository, 'load').mockResolvedValue(
      failure({ code: 'io-error', message: 'The settings file is locked.' }),
    );
    const store = createSettingsStore(repository);
    const ready = settingsReady(store);
    await store.getState().load();
    expect(await ready).toBe('loaded');
    expect(store.getState().error?.code).toBe('io-error');
  });
});
