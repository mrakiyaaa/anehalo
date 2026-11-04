import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '@/app/App';
import { AppProviders } from '@/app/providers/AppProviders';

describe('App', () => {
  it('renders the empty desktop shell', () => {
    render(
      <AppProviders>
        <App />
      </AppProviders>,
    );

    expect(screen.getByRole('banner')).toContainElement(
      screen.getByRole('heading', { name: 'Anehalo', level: 1 }),
    );
    expect(screen.getByRole('complementary', { name: 'Sidebar' })).toBeEmptyDOMElement();
    expect(screen.getByRole('main', { name: 'Workspace' })).toHaveTextContent(/^$/);
    expect(screen.getByRole('contentinfo')).toContainElement(screen.getByRole('status'));
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
