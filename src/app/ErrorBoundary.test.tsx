import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

describe('application recovery', () => {
  it('keeps normal content available', () => {
    render(
      <ErrorBoundary>
        <p>Workspace</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('Workspace')).toBeInTheDocument();
  });
  it('offers reload after a render failure', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    function BrokenEditor(): never {
      throw new Error('Broken editor');
    }
    render(
      <ErrorBoundary>
        <BrokenEditor />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Your notes are safe.');
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
  });
});
