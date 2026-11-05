import { describe, expect, it } from 'vitest';
import { defaultSettings, normalizeUserName } from '@/features/settings/AppSettings';
import { InMemorySettingsRepository } from '@/features/settings/InMemorySettingsRepository';
import { createSettingsStore } from '@/features/settings/settings-store';
import { unwrapResult } from '@/test/repository-helpers';

describe('settings persistence', () => {
  it('migrates settings from before the editor without restarting onboarding', async () => {
    const repository = new InMemorySettingsRepository(
      JSON.stringify({
        onboardingCompleted: true,
        userName: 'Akila',
        vaultPath: 'D:/Notes',
        theme: 'dark',
      }),
    );
    expect(unwrapResult(await repository.load())).toEqual({
      ...defaultSettings('D:/Notes'),
      onboardingCompleted: true,
      userName: 'Akila',
      theme: 'dark',
    });
  });

  it('preserves the last note when theme and note settings update together', async () => {
    const repository = new InMemorySettingsRepository(
      JSON.stringify({ ...defaultSettings('Memory/Anehalo'), onboardingCompleted: true }),
    );
    const store = createSettingsStore(repository);
    await store.getState().load();
    await Promise.all([
      store.getState().updateTheme('dark'),
      store.getState().updateLastOpenedNote('Work/Plan.md'),
    ]);
    expect(unwrapResult(await repository.load())).toMatchObject({
      theme: 'dark',
      lastOpenedNotePath: 'Work/Plan.md',
      reopenLastNote: true,
    });
  });
  it('loads defaults for a missing file without completing onboarding', async () => {
    const repository = new InMemorySettingsRepository();
    expect(unwrapResult(await repository.load())).toEqual(defaultSettings('Memory/Anehalo'));
    expect(repository.file.content).toBeNull();
  });

  it.each([
    '{broken json',
    'null',
    '[]',
    '{"theme":"purple"}',
    '{"onboardingCompleted":true,"userName":"A","vaultPath":"","theme":"light"}',
  ])('falls back to defaults for corrupt or invalid settings: %s', async (content) => {
    expect(unwrapResult(await new InMemorySettingsRepository(content).load())).toEqual(
      defaultSettings('Memory/Anehalo'),
    );
  });

  it('saves and restores every setting, trimming the name', async () => {
    const repository = new InMemorySettingsRepository();
    const settings = {
      ...defaultSettings('D:/Notes'),
      userName: '  Akila  ',
      theme: 'dark' as const,
      onboardingCompleted: true,
    };
    const saved = unwrapResult(await repository.save(settings));
    expect(saved.userName).toBe('Akila');
    const restarted = new InMemorySettingsRepository(repository.file.content);
    expect(unwrapResult(await restarted.load())).toEqual(saved);
  });

  it('keeps the previous settings and exposes an error when saving fails', async () => {
    const repository = new InMemorySettingsRepository();
    const store = createSettingsStore(repository);
    await store.getState().load();
    repository.file.writeError = new Error('Access denied');
    expect(
      (await store.getState().save({ ...defaultSettings('D:/Notes'), onboardingCompleted: true }))
        .ok,
    ).toBe(false);
    expect(store.getState().settings?.onboardingCompleted).toBe(false);
    expect(store.getState().error?.code).toBe('permission-denied');
    expect(store.getState().isSaving).toBe(false);
    expect((await store.getState().flushPendingSaves()).ok).toBe(false);
  });

  it('loads into the store and persists theme updates after onboarding', async () => {
    const repository = new InMemorySettingsRepository(
      JSON.stringify({ ...defaultSettings('Memory/Anehalo'), onboardingCompleted: true }),
    );
    const store = createSettingsStore(repository);
    await Promise.all([store.getState().load(), store.getState().load()]);
    expect(store.getState().isLoading).toBe(false);
    await store.getState().updateTheme('dark');
    expect(unwrapResult(await repository.load()).theme).toBe('dark');
    await store.getState().updateTheme('system');
    expect(unwrapResult(await repository.load()).theme).toBe('system');
  });

  it('keeps the last theme when choices change before a save finishes', async () => {
    const repository = new InMemorySettingsRepository(
      JSON.stringify({
        ...defaultSettings('Memory/Anehalo'),
        onboardingCompleted: true,
        theme: 'light',
      }),
    );
    const store = createSettingsStore(repository);
    await store.getState().load();
    await Promise.all([
      store.getState().updateTheme('dark'),
      store.getState().updateTheme('light'),
    ]);
    expect(unwrapResult(await repository.load()).theme).toBe('light');
    expect(store.getState().pendingSettings).toBeNull();
    expect(store.getState().isSaving).toBe(false);
  });
});

describe('user names', () => {
  it('trims whitespace and limits names to 30 characters', () => {
    expect(normalizeUserName('  Akila  ')).toBe('Akila');
    expect(normalizeUserName('  ')).toBe('');
    expect(normalizeUserName('a'.repeat(40))).toHaveLength(30);
    expect(Array.from(normalizeUserName('🌼'.repeat(40)))).toHaveLength(30);
  });
});
