import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TitleBar } from '@/components/layout/TitleBar';
import { useThemeStore } from '@/store/theme-store';
import type { Theme } from '@/types/theme';

function renderTitleBarIn(theme: Theme) {
  act(() => useThemeStore.setState({ theme }));
  render(<TitleBar />);
  return screen.getByRole('img', { name: 'Anehalo note icon' });
}

describe('TitleBar logo', () => {
  afterEach(() => {
    act(() => useThemeStore.setState({ theme: 'light' }));
  });

  it.each<[Theme, RegExp]>([
    ['light', /logo-note-light/],
    ['dark', /logo-note-dark/],
  ])('shows the note-only logo in the %s theme', (theme, expectedSource) => {
    const logo = renderTitleBarIn(theme);
    expect(logo).toHaveAttribute('src', expect.stringMatching(expectedSource));
    expect(logo).toHaveClass('logo-note');
    expect(screen.queryByRole('img', { name: /mascot/i })).not.toBeInTheDocument();
  });

  it('switches the note logo when the theme changes', () => {
    const logo = renderTitleBarIn('light');
    act(() => useThemeStore.setState({ theme: 'dark' }));
    expect(logo).toHaveAttribute('src', expect.stringMatching(/logo-note-dark/));
  });
});
