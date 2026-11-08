import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { success } from '@/features/storage/repository-result';
import { unwrapResult } from '@/test/repository-helpers';
import type { TrayEvents } from './TrayService';
import { TauriTrayService } from './TauriTrayService';

const native = vi.hoisted(() => ({
  listeners: new Map<string, (payload: unknown) => void>(),
  window: {
    onCloseRequested: vi.fn(() => Promise.resolve(() => undefined)),
    onFocusChanged: vi.fn(() => Promise.resolve(() => undefined)),
    show: vi.fn(() => Promise.resolve(undefined)),
    unminimize: vi.fn(() => Promise.resolve(undefined)),
    setFocus: vi.fn(() => Promise.resolve(undefined)),
    hide: vi.fn(() => Promise.resolve(undefined)),
    minimize: vi.fn(() => Promise.resolve(undefined)),
    isVisible: vi.fn(() => Promise.resolve(true)),
    isMinimized: vi.fn(() => Promise.resolve(false)),
    isFocused: vi.fn(() => Promise.resolve(true)),
  },
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: () => native.window }));
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn((name: string, listener: (event: { payload: unknown }) => void) => {
    const dispatch = (payload: unknown) => listener({ payload });
    native.listeners.set(name, dispatch);
    return Promise.resolve(() => {
      if (native.listeners.get(name) === dispatch) native.listeners.delete(name);
    });
  }),
}));

function events(): TrayEvents {
  return {
    close: vi.fn(),
    quit: vi.fn(),
    quickNote: vi.fn(),
    settings: vi.fn(),
    focus: vi.fn(),
    open: vi.fn(),
    toggle: vi.fn(),
    error: vi.fn(),
    arguments: vi.fn(() => Promise.resolve(success(undefined))),
  };
}

beforeEach(() => {
  native.listeners.clear();
  vi.mocked(invoke).mockResolvedValue([]);
});

describe('native desktop event transport', () => {
  it('delivers queued cold-start arguments and forwarded arguments in order', async () => {
    vi.mocked(invoke).mockResolvedValueOnce([['--new-note']]);
    const service = new TauriTrayService();
    const receiver = events();
    const disconnect = unwrapResult(await service.observe(receiver));
    await vi.waitFor(() => expect(receiver.arguments).toHaveBeenCalledWith(['--new-note']));
    vi.mocked(invoke).mockResolvedValueOnce([['--open'], ['--new-note']]);
    native.listeners.get('anehalo:arguments')?.(undefined);
    await vi.waitFor(() => expect(receiver.arguments).toHaveBeenCalledTimes(3));
    expect(
      vi.mocked(invoke).mock.calls.every(([command]) => command === 'take_pending_arguments'),
    ).toBe(true);
    disconnect();
  });

  it('preserves requests fetched during a workspace listener handoff', async () => {
    let deliver: (value: string[][]) => void = () => {
      throw new Error('Request was not started.');
    };
    vi.mocked(invoke).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          deliver = resolve;
        }),
    );
    const service = new TauriTrayService();
    const previous = events();
    const disconnect = unwrapResult(await service.observe(previous));
    await vi.waitFor(() => expect(invoke).toHaveBeenCalledOnce());
    disconnect();
    const next = events();
    const disconnectNext = unwrapResult(await service.observe(next));
    deliver([['--new-note']]);
    await vi.waitFor(() => expect(next.arguments).toHaveBeenCalledExactlyOnceWith(['--new-note']));
    expect(previous.arguments).not.toHaveBeenCalled();
    disconnectNext();
  });

  it('keeps launch requests queued during onboarding and shows the onboarding window', async () => {
    const service = new TauriTrayService();
    const onboarding = events();
    delete onboarding.arguments;
    const disconnect = unwrapResult(await service.observe(onboarding));
    native.listeners.get('anehalo:arguments')?.(undefined);
    expect(onboarding.open).toHaveBeenCalledOnce();
    expect(invoke).not.toHaveBeenCalled();
    disconnect();
  });

  it('reports a typed transport error and recovers on the next notification', async () => {
    vi.mocked(invoke).mockRejectedValueOnce(new Error('Access denied'));
    const receiver = events();
    const disconnect = unwrapResult(await new TauriTrayService().observe(receiver));
    await vi.waitFor(() => expect(receiver.error).toHaveBeenCalledOnce());
    vi.mocked(invoke).mockResolvedValueOnce([['--open']]);
    native.listeners.get('anehalo:arguments')?.(undefined);
    await vi.waitFor(() => expect(receiver.arguments).toHaveBeenCalledWith(['--open']));
    disconnect();
  });

  it('dispatches both tray menu actions and left-click toggles', async () => {
    const receiver = events();
    const disconnect = unwrapResult(await new TauriTrayService().observe(receiver));
    for (const action of ['open', 'quick-note', 'toggle'])
      native.listeners.get('anehalo:tray')?.(action);
    expect(receiver.open).toHaveBeenCalledOnce();
    expect(receiver.quickNote).toHaveBeenCalledOnce();
    expect(receiver.toggle).toHaveBeenCalledOnce();
    disconnect();
  });

  it('restores the native window before giving it focus and reads each visibility state', async () => {
    const service = new TauriTrayService();
    unwrapResult(await service.show());
    expect(native.window.show.mock.invocationCallOrder[0]).toBeLessThan(
      native.window.unminimize.mock.invocationCallOrder[0] ?? 0,
    );
    expect(native.window.unminimize.mock.invocationCallOrder[0]).toBeLessThan(
      native.window.setFocus.mock.invocationCallOrder[0] ?? 0,
    );
    expect(unwrapResult(await service.windowState())).toEqual({
      visible: true,
      minimized: false,
      focused: true,
    });
  });
});
