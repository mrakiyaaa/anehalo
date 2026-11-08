import { describe, expect, it, vi } from 'vitest';
import { validateShortcut, shortcutFromEvent } from './shortcut-validation';
import { TauriGlobalShortcutService } from './TauriGlobalShortcutService';
import { register, unregister } from '@tauri-apps/plugin-global-shortcut';
import { runtimePaths } from '@/app/runtime-paths';

vi.mock('@/app/runtime-paths', () => ({
  runtimePaths: vi.fn().mockResolvedValue({ isolated: false }),
}));

vi.mock('@tauri-apps/plugin-global-shortcut', () => ({
  register: vi.fn().mockResolvedValue(undefined),
  unregister: vi.fn().mockResolvedValue(undefined),
}));

describe('shortcut validation', () => {
  it('does not register host shortcuts during an isolated debug run', async () => {
    vi.mocked(runtimePaths).mockResolvedValueOnce({
      isolated: true,
      vault: 'C:/Test/vault',
      settings: 'C:/Test/settings',
    });
    const service = new TauriGlobalShortcutService();
    expect((await service.replace('Ctrl+Alt+N', () => undefined)).ok).toBe(true);
    vi.mocked(runtimePaths).mockResolvedValueOnce({
      isolated: true,
      vault: 'C:/Test/vault',
      settings: 'C:/Test/settings',
    });
    expect((await service.unregister()).ok).toBe(true);
    expect(register).not.toHaveBeenCalled();
    expect(unregister).not.toHaveBeenCalled();
  });
  it.each([
    'N',
    'Ctrl',
    'Ctrl+Ctrl+N',
    'Ctrl+',
    'Ctrl+Alt+Delete',
    'Alt+F4',
    'Alt+Tab',
    'Ctrl+Shift+Escape',
    'Win+L',
    'Super+R',
    'Ctrl+K',
    'Ctrl+F',
  ])('rejects invalid or reserved shortcut %s', (shortcut) => {
    expect(validateShortcut(shortcut).ok).toBe(false);
  });
  it.each(['Ctrl+Alt+N', 'Ctrl+Shift+J', 'Alt+F8', 'Shift+F12'])('accepts %s', (shortcut) => {
    expect(validateShortcut(shortcut)).toEqual({ ok: true, value: shortcut });
  });
  it('records physical letter keys with modifiers', () => {
    expect(
      shortcutFromEvent({
        key: 'න',
        code: 'KeyN',
        ctrlKey: true,
        altKey: true,
        shiftKey: false,
        metaKey: false,
      }),
    ).toBe('Ctrl+Alt+N');
  });
});

describe('native shortcut service', () => {
  it('keeps independent callbacks and registrations for both actions', async () => {
    const service = new TauriGlobalShortcutService();
    const quickNote = vi.fn();
    const open = vi.fn();
    await service.replace('Ctrl+Alt+N', quickNote);
    await service.replace('Ctrl+Alt+A', open, 'open');
    const quickNoteCallback = vi.mocked(register).mock.calls[0]?.[1];
    const openCallback = vi.mocked(register).mock.calls[1]?.[1];
    if (typeof quickNoteCallback !== 'function' || typeof openCallback !== 'function')
      throw new Error('Expected independent shortcut callbacks.');
    quickNoteCallback({ shortcut: 'Ctrl+Alt+N', id: 1, state: 'Pressed' });
    openCallback({ shortcut: 'Ctrl+Alt+A', id: 2, state: 'Pressed' });
    expect(quickNote).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledOnce();
    await service.unregister(open, 'open');
    expect(unregister).toHaveBeenCalledExactlyOnceWith('Ctrl+Alt+A');
    await service.unregister(quickNote);
    expect(unregister).toHaveBeenLastCalledWith('Ctrl+Alt+N');
  });

  it('rejects normalized duplicates before registering the second action', async () => {
    const service = new TauriGlobalShortcutService();
    await service.replace('Ctrl+Alt+N', () => undefined);
    expect(await service.replace('Alt+Control+N', () => undefined, 'open')).toMatchObject({
      ok: false,
      error: { code: 'conflict' },
    });
    expect(register).toHaveBeenCalledOnce();
    expect(unregister).not.toHaveBeenCalled();
  });
  it('registers, re-registers, and releases on exit', async () => {
    const service = new TauriGlobalShortcutService();
    const pressed = vi.fn();
    expect((await service.replace('Ctrl+Alt+N', pressed)).ok).toBe(true);
    expect(vi.mocked(register).mock.calls[0]?.[0]).toBe('Ctrl+Alt+N');
    expect(typeof vi.mocked(register).mock.calls[0]?.[1]).toBe('function');
    expect((await service.replace('Ctrl+Shift+J', pressed)).ok).toBe(true);
    expect(unregister).toHaveBeenCalledWith('Ctrl+Alt+N');
    await service.unregister();
    expect(unregister).toHaveBeenCalledWith('Ctrl+Shift+J');
  });
  it('returns a conflict with a recovery action and preserves the active registration', async () => {
    const service = new TauriGlobalShortcutService();
    await service.replace('Ctrl+Alt+N', () => undefined);
    vi.mocked(register).mockRejectedValueOnce(new Error('Already registered elsewhere'));
    const result = await service.replace('Ctrl+Shift+J', () => undefined);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected a shortcut conflict');
    expect(result.error.code).toBe('conflict');
    expect(result.error.message).toContain('Settings');
    expect(unregister).not.toHaveBeenCalled();
    await service.unregister();
  });
  it('updates the callback when a new vault takes ownership and ignores stale cleanup', async () => {
    const service = new TauriGlobalShortcutService();
    const previous = vi.fn();
    const current = vi.fn();
    await service.replace('Ctrl+Alt+N', previous);
    await service.replace('Ctrl+Alt+N', current);
    expect(register).toHaveBeenCalledOnce();
    await service.unregister(previous);
    expect(unregister).not.toHaveBeenCalled();
    const callback = vi.mocked(register).mock.calls[0]?.[1];
    if (typeof callback !== 'function') throw new Error('Expected a shortcut callback');
    callback({ shortcut: 'Ctrl+Alt+N', id: 1, state: 'Pressed' });
    callback({ shortcut: 'Ctrl+Alt+N', id: 1, state: 'Pressed' });
    expect(current).toHaveBeenCalledOnce();
    expect(previous).not.toHaveBeenCalled();
    callback({ shortcut: 'Ctrl+Alt+N', id: 1, state: 'Released' });
    callback({ shortcut: 'Ctrl+Alt+N', id: 1, state: 'Pressed' });
    expect(current).toHaveBeenCalledTimes(2);
    await service.unregister(current);
    expect(unregister).toHaveBeenCalledWith('Ctrl+Alt+N');
  });
});
