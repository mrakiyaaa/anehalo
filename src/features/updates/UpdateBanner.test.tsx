import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DesktopContext } from '@/features/tray/desktop-context';
import { UpdateBanner, UpdateBannerView, type UpdateBannerActions } from './UpdateBanner';
import { createUpdateRuntime } from './update-test-runtime';

const disposers: (() => void)[] = [];
afterEach(() => {
  for (const dispose of disposers.splice(0)) dispose();
});

function actions(): UpdateBannerActions {
  return { install: vi.fn(), later: vi.fn(), dismiss: vi.fn() };
}

describe('the update banner, state by state', () => {
  it('shows nothing when there is no update', () => {
    const { container } = render(
      <UpdateBannerView update={{ kind: 'idle' }} actions={actions()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('offers an available update with Update now and Later', async () => {
    const handlers = actions();
    render(
      <UpdateBannerView update={{ kind: 'available', version: '0.1.2' }} actions={handlers} />,
    );
    const banner = screen.getByRole('status');
    expect(banner).toHaveTextContent('Anehalo 0.1.2 is available');
    await userEvent.setup().click(within(banner).getByRole('button', { name: 'Update now' }));
    expect(handlers.install).toHaveBeenCalledTimes(1);
    await userEvent.setup().click(within(banner).getByRole('button', { name: 'Later' }));
    expect(handlers.later).toHaveBeenCalledTimes(1);
  });

  it('shows download progress as a percentage', () => {
    render(
      <UpdateBannerView
        update={{ kind: 'downloading', version: '0.1.2', downloaded: 450, total: 1000 }}
        actions={actions()}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Downloading Anehalo 0.1.2… 45%');
    expect(screen.getByRole('progressbar', { name: 'Update progress' })).toHaveValue(45);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows an unknown-size download without a percentage', () => {
    render(
      <UpdateBannerView
        update={{ kind: 'downloading', version: '0.1.2', downloaded: 450, total: null }}
        actions={actions()}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Downloading Anehalo 0.1.2…');
    expect(screen.getByRole('status')).not.toHaveTextContent('%');
    expect(screen.getByRole('progressbar')).not.toHaveAttribute('value');
  });

  it('says it is installing and offers no buttons', () => {
    render(
      <UpdateBannerView update={{ kind: 'installing', version: '0.1.2' }} actions={actions()} />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Installing Anehalo 0.1.2');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows an error as an alert with Try again and Dismiss', async () => {
    const handlers = actions();
    render(
      <UpdateBannerView
        update={{ kind: 'error', version: '0.1.2', message: 'The update could not be downloaded.' }}
        actions={handlers}
      />,
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('The update could not be downloaded.');
    await userEvent.setup().click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(handlers.install).toHaveBeenCalledTimes(1);
    await userEvent
      .setup()
      .click(within(alert).getByRole('button', { name: 'Dismiss update message' }));
    expect(handlers.dismiss).toHaveBeenCalledTimes(1);
  });
});

describe('the connected banner', () => {
  async function mount() {
    const context = await createUpdateRuntime();
    disposers.push(context.dispose);
    context.updater.offer = { version: '0.1.2' };
    render(
      <DesktopContext.Provider value={context.runtime}>
        <UpdateBanner />
      </DesktopContext.Provider>,
    );
    await act(async () => {
      await context.runtime.updates.start();
      await context.runtime.updates.checkNow();
    });
    return context;
  }

  it('appears when an update is found and disappears on Later', async () => {
    await mount();
    expect(screen.getByRole('status')).toHaveTextContent('Anehalo 0.1.2 is available');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Later' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('goes through downloading and installing when Update now is pressed', async () => {
    const { updater } = await mount();
    let release = () => {};
    updater.downloadGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Update now' }));
    expect(await screen.findByText('Downloading Anehalo 0.1.2… 100%')).toBeInTheDocument();
    await act(async () => {
      release();
      await Promise.resolve();
    });
    expect(await screen.findByText(/Installing Anehalo 0.1.2/)).toBeInTheDocument();
  });

  it('shows the error and lets the user try again', async () => {
    const { updater } = await mount();
    updater.downloadError = { code: 'unavailable', message: 'Offline.' };
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Update now' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be downloaded');
    updater.downloadError = null;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText(/Installing Anehalo 0.1.2/)).toBeInTheDocument();
  });
});
