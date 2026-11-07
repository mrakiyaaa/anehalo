import { afterEach, describe, expect, it, vi } from 'vitest';
import { error } from '@tauri-apps/plugin-log';
import { isTauri } from '@tauri-apps/api/core';
import { logFailure, observeUnhandledErrors } from './error-logging';

vi.mock('@tauri-apps/plugin-log', () => ({ error: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@tauri-apps/api/core', () => ({ isTauri: vi.fn(() => true) }));
afterEach(() => vi.mocked(isTauri).mockReturnValue(true));

describe('private diagnostics', () => {
  it('logs unhandled events without their content or stack', () => {
    observeUnhandledErrors();
    window.dispatchEvent(
      new ErrorEvent('error', {
        message: 'private note text',
        error: new Error('private note text'),
      }),
    );
    const rejection = new Event('unhandledrejection');
    Object.defineProperty(rejection, 'reason', { value: 'private rejected content' });
    window.dispatchEvent(rejection);
    expect(error).toHaveBeenCalledWith('{"event":"unhandled-error"}');
    expect(error).toHaveBeenCalledWith('{"event":"unhandled-rejection"}');
    expect(JSON.stringify(vi.mocked(error).mock.calls)).not.toContain('private');
  });
  it('writes only a save event and typed error code, and skips browser previews', () => {
    logFailure('save-failed', 'permission-denied');
    expect(error).toHaveBeenCalledWith('{"event":"save-failed","code":"permission-denied"}');
    vi.mocked(isTauri).mockReturnValue(false);
    logFailure('render-error');
    expect(error).toHaveBeenCalledOnce();
  });
});
