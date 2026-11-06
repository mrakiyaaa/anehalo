import { describe, expect, it, vi } from 'vitest';
import { validateShortcut, shortcutFromEvent } from './shortcut-validation';
import { TauriGlobalShortcutService } from './TauriGlobalShortcutService';
import { register, unregister } from '@tauri-apps/plugin-global-shortcut';

vi.mock('@tauri-apps/plugin-global-shortcut', () => ({
  register: vi.fn().mockResolvedValue(undefined),
  unregister: vi.fn().mockResolvedValue(undefined),
}));

describe('shortcut validation', () => {
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
