import { Component, type PropsWithChildren } from 'react';
import { logFailure } from '@/features/diagnostics/error-logging';

export class ErrorBoundary extends Component<PropsWithChildren, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(): void {
    logFailure('render-error');
  }

  render() {
    if (this.state.failed)
      return (
        <main className="recovery-screen" role="alert">
          <h1>Something went wrong.</h1>
          <p>Your notes are safe.</p>
          <button type="button" onClick={() => window.location.reload()}>
            Reload
          </button>
        </main>
      );
    return this.props.children;
  }
}
