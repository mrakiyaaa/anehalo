import { describe, expect, it } from 'vitest';
import { defaultSettings } from '@/features/settings/AppSettings';
import { InMemorySettingsRepository } from '@/features/settings/InMemorySettingsRepository';
import { InMemoryNoteRepository } from '@/features/storage/InMemoryNoteRepository';
import { InMemoryFolderAccess } from '@/features/onboarding/InMemoryFolderAccess';
import { createOnboardingStore } from '@/features/onboarding/onboarding-store';
import { unwrapResult } from '@/test/repository-helpers';

function createSetup() {
  const settings = new InMemorySettingsRepository();
  const folders = new InMemoryFolderAccess();
  const vault = new InMemoryNoteRepository();
  const openedPaths: string[] = [];
  const store = createOnboardingStore({
    defaults: defaultSettings('Memory/Anehalo'),
    folderAccess: folders,
    createNoteRepository: (path) => {
      openedPaths.push(path);
      return vault;
    },
    saveSettings: (answers) => settings.save(answers),
  });
  return { store, settings, folders, vault, openedPaths };
}

describe('onboarding navigation', () => {
  it('moves forward and back with direction and stops at the bounds', () => {
    const { store } = createSetup();
    store.getState().back();
    expect(store.getState().step).toBe(0);
    store.getState().next();
    expect(store.getState()).toMatchObject({ step: 1, direction: 1 });
    store.getState().back();
    expect(store.getState()).toMatchObject({ step: 0, direction: -1 });
    for (let index = 0; index < 6; index += 1) store.getState().next();
    expect(store.getState()).toMatchObject({ step: 4, isSummary: true });
    store.getState().back();
    expect(store.getState()).toMatchObject({ step: 4, isSummary: false, direction: -1 });
  });

  it('does not complete before the summary is shown', async () => {
    const { store, settings, openedPaths } = createSetup();
    expect((await store.getState().finish()).ok).toBe(false);
    expect(settings.file.content).toBeNull();
    expect(openedPaths).toEqual([]);
  });

  it('limits input and trims the saved name on completion', async () => {
    const { store } = createSetup();
    store.getState().setName('a'.repeat(40));
    expect(store.getState().answers.userName).toHaveLength(30);
    store.getState().setName('  Akila  ');
    for (let index = 0; index < 5; index += 1) store.getState().next();
    expect(unwrapResult(await store.getState().finish()).userName).toBe('Akila');
  });
});

describe('folder validation and completion', () => {
  it('accepts a writable custom folder and creates starter content only when opened', async () => {
    const { store, folders, settings, vault, openedPaths } = createSetup();
    folders.selection = 'D:/My notes';
    await store.getState().chooseFolder();
    expect(store.getState().answers.vaultPath).toBe('D:/My notes/Anehalo');
    expect(folders.createdDirectories.has('D:/My notes/Anehalo')).toBe(true);
    expect(openedPaths).toEqual([]);
    expect(unwrapResult(await vault.listTree()).notes).toEqual([]);
    store.getState().setTheme('dark');
    for (let index = 0; index < 5; index += 1) store.getState().next();
    expect(settings.file.content).toBeNull();
    const saved = unwrapResult(await store.getState().finish());
    expect(saved).toMatchObject({
      vaultPath: 'D:/My notes/Anehalo',
      theme: 'dark',
      onboardingCompleted: true,
    });
    expect(openedPaths).toEqual(['D:/My notes/Anehalo']);
    expect(unwrapResult(await vault.listTree()).notes[0]?.relativePath).toBe(
      'Getting started/Welcome.md',
    );
    expect(unwrapResult(await settings.load())).toEqual(saved);
  });

  it('rejects unwritable folders without changing the selected path', async () => {
    const { store, folders } = createSetup();
    folders.selection = 'D:/Read only';
    folders.unwritablePaths.add(folders.selection);
    await store.getState().chooseFolder();
    expect(store.getState().answers.vaultPath).toBe('Memory/Anehalo');
    expect(store.getState().error?.message).toContain('not writable');
    expect(store.getState().isBusy).toBe(false);
  });

  it('keeps the existing selection when the picker is cancelled', async () => {
    const { store } = createSetup();
    await store.getState().chooseFolder();
    expect(store.getState().answers.vaultPath).toBe('Memory/Anehalo');
    expect(store.getState().error).toBeNull();
  });

  it('rechecks access on completion and keeps onboarding open if access is lost', async () => {
    const { store, folders, settings, openedPaths } = createSetup();
    store.getState().skip();
    folders.unwritablePaths.add('Memory/Anehalo');
    expect((await store.getState().finish()).ok).toBe(false);
    expect(settings.file.content).toBeNull();
    expect(openedPaths).toEqual([]);
    expect(store.getState().isSummary).toBe(true);
  });

  it('surfaces vault and settings failures and allows a safe retry', async () => {
    const { store, vault, settings } = createSetup();
    store.getState().skip();
    vault.memoryFileSystem.failNext('write');
    expect((await store.getState().finish()).ok).toBe(false);
    expect(settings.file.content).toBeNull();
    settings.file.writeError = new Error('Disk full');
    expect((await store.getState().finish()).ok).toBe(false);
    expect(store.getState().error?.message).toContain('save your settings');
    settings.file.writeError = null;
    expect((await store.getState().finish()).ok).toBe(true);
    expect(unwrapResult(await vault.listTree()).notes[0]?.title).toBe('Welcome');
  });

  it('skip discards all answers and saves defaults only after Open Anehalo', async () => {
    const { store, folders, settings, vault } = createSetup();
    folders.selection = 'D:/Other';
    await store.getState().chooseFolder();
    store.getState().setName('Akila');
    store.getState().setTheme('dark');
    store.getState().skip();
    expect(store.getState().answers).toEqual(defaultSettings('Memory/Anehalo'));
    expect(settings.file.content).toBeNull();
    expect(unwrapResult(await store.getState().finish())).toEqual({
      ...defaultSettings('Memory/Anehalo'),
      onboardingCompleted: true,
    });
    expect(unwrapResult(await vault.listTree()).notes).toHaveLength(1);
  });
});
