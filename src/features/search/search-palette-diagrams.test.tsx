import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import type { WorkspaceStore } from '@/store/workspace-store';
import { renderWorkspace } from '@/test/workspace-render';
import { SearchPalette } from './SearchPalette';

const diagram = JSON.stringify({
  type: 'excalidraw',
  elements: [
    { id: 'box', type: 'rectangle' },
    { id: 'label', type: 'text', text: 'Payment gateway', containerId: 'box' },
  ],
});

const stores: WorkspaceStore[] = [];
afterEach(() => stores.splice(0).forEach((store) => store.getState().pauseAutoSave()));

async function openPalette() {
  const rendered = await renderWorkspace(
    [
      { relativePath: 'Gateway notes.md', type: 'file', content: 'About the gateway' },
      { relativePath: 'Plans', type: 'directory' },
      { relativePath: 'Plans/Checkout.excalidraw', type: 'file', content: diagram },
    ],
    <SearchPalette />,
  );
  stores.push(rendered.store);
  await rendered.store.getState().initialize();
  act(() => rendered.store.getState().setSearchOpen(true));
  const user = userEvent.setup();
  const input = await screen.findByRole('combobox', { name: 'Search notes and diagrams' });
  return { ...rendered, user, input };
}

const results = () => screen.getByRole('listbox', { name: 'Search results' });

/** Results for what was typed, not the previous query's (the palette is busy until then). */
async function settledResults() {
  await waitFor(() => expect(results()).toHaveAttribute('aria-busy', 'false'));
  return results();
}

describe('the results list when nothing is found', () => {
  it('holds a disabled option, so the listbox is never empty of options', async () => {
    const { user, input } = await openPalette();
    await user.type(input, 'zzzznothing');
    const list = await settledResults();
    await waitFor(() => expect(within(list).getByRole('option')).toBeInTheDocument());
    const message = within(list).getByRole('option');
    expect(message).toHaveTextContent('Nothing found. Try another word.');
    expect(message).toHaveAttribute('aria-disabled', 'true');
    expect(input).not.toHaveAttribute('aria-activedescendant');
  });
});

describe('diagrams in Ctrl+K', () => {
  it('shows a diagram row with its icon, folder and highlighted snippet', async () => {
    const { user, input } = await openPalette();
    // As on a slow machine: "Recently edited" already lists the diagram, without highlights.
    await within(results()).findByRole('option', { name: /Diagram:\s*Checkout/ });
    await user.type(input, 'gateway');
    const row = await within(await settledResults()).findByRole('option', {
      name: /Diagram:\s*Checkout/,
    });
    expect(row.querySelector('[data-icon="shapes"]')).not.toBeNull();
    expect(within(row).getByText('Plans')).toBeVisible();
    expect(within(row).getByText('gateway', { selector: 'mark' })).toBeVisible();
    expect(within(results()).getByRole('option', { name: /Gateway notes/ })).toBeVisible();
  });

  it('filters results with the All / Notes / Diagrams chips', async () => {
    const { user, input } = await openPalette();
    await user.type(input, 'gateway');
    await within(await settledResults()).findByRole('option', { name: /Checkout/ });
    const chips = screen.getByRole('group', { name: 'Show' });

    await user.click(within(chips).getByRole('button', { name: 'Diagrams' }));
    await waitFor(() =>
      expect(within(results()).queryByRole('option', { name: /Gateway notes/ })).toBeNull(),
    );
    expect(within(chips).getByRole('button', { name: 'Diagrams' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(within(chips).getByRole('button', { name: 'Notes' }));
    await waitFor(() =>
      expect(within(results()).queryByRole('option', { name: /Checkout/ })).toBeNull(),
    );
    expect(within(results()).getByRole('option', { name: /Gateway notes/ })).toBeVisible();
  });

  it('opens a content match on the diagram and asks for its element to be shown', async () => {
    const { store, user, input } = await openPalette();
    await user.type(input, 'gateway');
    await user.click(
      await within(await settledResults()).findByRole('option', { name: /Checkout/ }),
    );
    await waitFor(() => expect(store.getState().view).toBe('diagram'));
    expect(store.getState().elementFocus).toEqual({
      path: 'Plans/Checkout.excalidraw',
      elementId: 'box',
    });
    expect(store.getState().isSearchOpen).toBe(false);
  });

  it('opens a title match without asking for an element', async () => {
    const { store, user, input } = await openPalette();
    await user.type(input, 'checkout');
    await user.click(
      await within(await settledResults()).findByRole('option', { name: /Checkout/ }),
    );
    await waitFor(() => expect(store.getState().view).toBe('diagram'));
    expect(store.getState().elementFocus).toBeNull();
  });
});
