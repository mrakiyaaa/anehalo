import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '@/app/App';
import { AppProviders } from '@/app/providers/AppProviders';
import { useWorkspaceStore } from '@/store/workspace-store';

describe('App', () => {
  beforeEach(() => {
    useWorkspaceStore.setState({ activeFolderId: null, searchText: '' });
  });

  it('renders the home shell with its mock notes and window controls', () => {
    render(
      <AppProviders>
        <App />
      </AppProviders>,
    );

    expect(screen.getByRole('banner')).toHaveTextContent('Anehalo');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /Good (morning|afternoon|evening), Akila/,
    );
    expect(screen.getAllByRole('article')).toHaveLength(8);
    expect(screen.getByRole('contentinfo')).toHaveTextContent('8 notes · 6 folders');
    expect(screen.getByRole('switch', { name: 'Dark mode' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('combines folder selection and search from the UI', async () => {
    const user = userEvent.setup();
    render(
      <AppProviders>
        <App />
      </AppProviders>,
    );

    await user.click(
      within(screen.getByRole('navigation', { name: 'Folders' })).getByRole('button', {
        name: 'Work, 2 notes',
      }),
    );
    expect(screen.getAllByRole('article')).toHaveLength(2);
    await user.type(screen.getByRole('searchbox', { name: 'Search notes' }), 'password');
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'Login flow test cases' })).toBeInTheDocument();
    await user.clear(screen.getByRole('searchbox', { name: 'Search notes' }));
    expect(screen.getAllByRole('article')).toHaveLength(2);
  });

  it('focuses capture and shows visual save feedback without adding a note', async () => {
    const user = userEvent.setup();
    render(
      <AppProviders>
        <App />
      </AppProviders>,
    );

    await user.click(screen.getByRole('button', { name: 'Quick note' }));
    const capture = screen.getByRole('textbox', { name: 'Quick capture' });
    expect(capture).toHaveFocus();
    await user.click(screen.getByRole('searchbox', { name: 'Search notes' }));
    await user.keyboard('{Control>}{Alt>}n{/Alt}{/Control}');
    expect(capture).toHaveFocus();
    await user.type(capture, 'A temporary thought');
    expect(screen.getByRole('status')).toHaveTextContent('Saving…');
    expect(await screen.findByText('Saved just now')).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(8);
  });
});
