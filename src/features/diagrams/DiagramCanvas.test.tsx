import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PropsWithChildren, ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useThemeStore } from '@/store/theme-store';
import { sceneWith } from '@/test/diagram-helpers';
import type { DiagramScene } from './diagram-codec';

const excalidraw = vi.hoisted(() => ({
  assetPathWhenLoaded: undefined as string | undefined,
  lastProps: null as Record<string, unknown> | null,
}));

// jsdom has no canvas, so the real Excalidraw cannot render here. The stand-in records the
// props it receives and renders the menu items Anehalo passes in.
vi.mock('@excalidraw/excalidraw', () => {
  excalidraw.assetPathWhenLoaded = window.EXCALIDRAW_ASSET_PATH;
  function MenuItem({
    children,
    onSelect,
  }: {
    children: ReactNode;
    onSelect?: (event: Event) => void;
  }) {
    return (
      <button type="button" role="menuitem" onClick={(event) => onSelect?.(event.nativeEvent)}>
        {children}
      </button>
    );
  }
  function DefaultItem(label: string) {
    return function Item() {
      return <MenuItem>{label}</MenuItem>;
    };
  }
  function Passthrough({ children }: PropsWithChildren) {
    return <>{children}</>;
  }
  const MainMenu = Object.assign(
    ({ children }: PropsWithChildren) => <div role="menu">{children}</div>,
    {
      Item: MenuItem,
      DefaultItems: { ClearCanvas: DefaultItem('Reset the canvas'), Help: DefaultItem('Help') },
    },
  );
  const WelcomeScreen = Object.assign(Passthrough, {
    Hints: { MenuHint: () => null, ToolbarHint: () => null, HelpHint: () => null },
  });
  return {
    Excalidraw: ({ children, ...props }: PropsWithChildren<Record<string, unknown>>) => {
      excalidraw.lastProps = props;
      return <div data-testid="excalidraw">{children}</div>;
    },
    MainMenu,
    WelcomeScreen,
    hashElementsVersion: (elements: readonly { version?: number }[]) =>
      elements.reduce((sum, element) => sum + (element.version ?? 0), 0),
  };
});

const { DiagramCanvas } = await import('./DiagramCanvas');

type ChangeHandler = (
  elements: DiagramScene['elements'],
  appState: DiagramScene['appState'],
  files: DiagramScene['files'],
) => void;

function renderCanvas(onDocumentChange: (scene: DiagramScene) => void = () => undefined) {
  render(<DiagramCanvas scene={sceneWith('start')} onDocumentChange={onDocumentChange} />);
  const onChange = excalidraw.lastProps?.onChange;
  if (typeof onChange !== 'function') throw new Error('Excalidraw received no onChange.');
  return onChange as ChangeHandler;
}

describe('DiagramCanvas', () => {
  afterEach(() => {
    act(() => useThemeStore.setState({ theme: 'light' }));
  });

  it('points Excalidraw at the bundled fonts before Excalidraw loads', () => {
    expect(excalidraw.assetPathWhenLoaded).toBe('/excalidraw/');
  });

  it('passes the offline options and follows the Anehalo theme', () => {
    act(() => useThemeStore.setState({ theme: 'dark' }));
    renderCanvas();

    expect(excalidraw.lastProps).toMatchObject({ theme: 'dark', aiEnabled: false, langCode: 'en' });
    act(() => useThemeStore.setState({ theme: 'light' }));
    expect(excalidraw.lastProps).toMatchObject({ theme: 'light' });
  });

  it('offers only Anehalo menu items: theme, clear canvas, and help', () => {
    renderCanvas();

    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Dark mode',
      'Reset the canvas',
      'Help',
    ]);
  });

  it('switches the Anehalo theme from the menu', async () => {
    renderCanvas();

    await userEvent.setup().click(screen.getByRole('menuitem', { name: 'Dark mode' }));

    await waitFor(() => expect(useThemeStore.getState().theme).toBe('dark'));
    expect(await screen.findByRole('menuitem', { name: 'Light mode' })).toBeInTheDocument();
  });

  it('loads the given drawing and reports only document changes', () => {
    const changes: DiagramScene[] = [];
    const onChange = renderCanvas((scene) => changes.push(scene));
    const start = sceneWith('start');
    expect(excalidraw.lastProps?.initialData).toMatchObject({ elements: start.elements });

    onChange(start.elements, { ...start.appState, zoom: { value: 2 } } as never, {});
    onChange(start.elements, { ...start.appState, scrollX: 300 }, {});
    expect(changes).toEqual([]);

    const moved = start.elements.map((element) => ({ ...element, version: 2 }));
    onChange(moved, start.appState, {});
    onChange(moved, { ...start.appState, selectedElementIds: { start: true } } as never, {});
    expect(changes.map((scene) => scene.elements)).toEqual([moved]);
  });
});
