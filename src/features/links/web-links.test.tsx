import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useElementLinkOpener } from '@/features/diagrams/use-element-link-opener';
import type { WorkspaceStore } from '@/store/workspace-store';
import { diagramFile } from '@/test/diagram-helpers';
import { renderWorkspace } from '@/test/workspace-render';
import { classifyElementLink } from './element-links';
import { openWebLink } from './web-links';

const logFailure = vi.hoisted(() => vi.fn());
vi.mock('@/features/diagnostics/error-logging', () => ({ logFailure }));
vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: vi.fn(() => Promise.resolve()) }));

const stores: WorkspaceStore[] = [];
afterEach(() => {
  logFailure.mockClear();
  vi.mocked(openUrl).mockClear();
  stores.splice(0).forEach((store) => store.getState().pauseAutoSave());
});

describe('classifying diagram element links', () => {
  it.each([
    ['Work/Plan.md', { kind: 'item', path: 'Work/Plan.md' }],
    ['Work/My%20flow.excalidraw', { kind: 'item', path: 'Work/My flow.excalidraw' }],
    ['සටහන්/සිංහල%20රූපය.excalidraw', { kind: 'item', path: 'සටහන්/සිංහල රූපය.excalidraw' }],
    ['https://example.com/a?b=1', { kind: 'web', url: 'https://example.com/a?b=1' }],
    ['  HTTP://example.com/  ', { kind: 'web', url: 'HTTP://example.com/' }],
  ])('opens %s', (link, expected) => {
    expect(classifyElementLink(link)).toEqual(expected);
  });

  it.each([
    'javascript:alert(1)',
    'file:///C:/Windows/System32/cmd.exe',
    'mailto:someone@example.com',
    'data:text/html,<p>hi</p>',
    '../Outside.md',
    'C:/Users/Notes/Plan.md',
    'Work/Picture.png',
    '',
  ])('blocks %s', (link) => {
    expect(classifyElementLink(link)).toEqual({ kind: 'blocked' });
  });
});

describe('opening web links', () => {
  it('hands http(s) links to the default browser', async () => {
    expect((await openWebLink(' https://example.com/ ')).ok).toBe(true);
    expect(openUrl).toHaveBeenCalledExactlyOnceWith('https://example.com/');
    expect(logFailure).not.toHaveBeenCalled();
  });

  it('refuses and logs anything else without calling the opener', async () => {
    const result = await openWebLink('file:///C:/Windows/System32/cmd.exe');
    expect(result).toMatchObject({ ok: false, error: { code: 'invalid-path' } });
    expect(openUrl).not.toHaveBeenCalled();
    expect(logFailure).toHaveBeenCalledWith('blocked-link');
  });

  it('reports a failure of the opener with a message and a log entry', async () => {
    vi.mocked(openUrl).mockRejectedValueOnce(new Error('No browser'));
    const result = await openWebLink('https://example.com/');
    expect(result.ok).toBe(false);
    expect(logFailure).toHaveBeenCalledWith('web-link-failed');
  });
});

function LinkButton({ link }: { link: string }) {
  const open = useElementLinkOpener();
  return (
    <button type="button" onClick={() => open(link)}>
      Follow
    </button>
  );
}

describe('following a link on a diagram element', () => {
  async function follow(link: string) {
    const rendered = await renderWorkspace(
      [
        { relativePath: 'Plan.md', type: 'file', content: 'Plan' },
        { relativePath: 'Flow.excalidraw', type: 'file', content: diagramFile('a') },
      ],
      <LinkButton link={link} />,
    );
    stores.push(rendered.store);
    fireEvent.click(screen.getByRole('button', { name: 'Follow' }));
    return rendered.store;
  }

  it('opens a vault note in the app', async () => {
    const store = await follow('Plan.md');
    await waitFor(() => expect(store.getState().openDraft?.note.relativePath).toBe('Plan.md'));
    expect(openUrl).not.toHaveBeenCalled();
  });

  it('opens a web link in the browser, not in the app', async () => {
    const store = await follow('https://example.com/');
    await waitFor(() => expect(openUrl).toHaveBeenCalledWith('https://example.com/'));
    expect(store.getState().view).toBe('home');
  });

  it('blocks other links with a message and a log entry', async () => {
    const store = await follow('javascript:alert(1)');
    expect(store.getState().error?.message).toBe('Anehalo does not open this kind of link.');
    expect(logFailure).toHaveBeenCalledWith('blocked-link');
    expect(openUrl).not.toHaveBeenCalled();
  });
});
