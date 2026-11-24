import { act, configure, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Importing loads Excalidraw, which probes a 2D canvas when it loads; jsdom has none.
vi.hoisted(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: () => ({}),
  });
});
import { FolderList } from '@/features/folders/FolderList';
import { CaptureCard } from '@/features/editor/CaptureCard';
import type { WorkspaceStore } from '@/store/workspace-store';
import { pngImage } from '@/test/image-fixtures';
import { renderWorkspace } from '@/test/workspace-render';
import { DiagramImportProvider } from './DiagramImportProvider';
import { LARGE_IMPORT_BYTES } from './import-file-kind';

// The first import loads Excalidraw, which takes longer than the default wait on a busy machine.
configure({ asyncUtilTimeout: 15_000 });

const stores: WorkspaceStore[] = [];
afterEach(() => stores.splice(0).forEach((store) => store.getState().pauseAutoSave()));

const rectangle = {
  id: 'box',
  type: 'rectangle',
  x: 0,
  y: 0,
  width: 40,
  height: 40,
  angle: 0,
  strokeColor: '#1e1e1e',
  backgroundColor: 'transparent',
  fillStyle: 'solid',
  strokeWidth: 2,
  strokeStyle: 'solid',
  roughness: 1,
  opacity: 100,
  groupIds: [],
  frameId: null,
  index: null,
  roundness: null,
  seed: 1,
  version: 1,
  versionNonce: 7,
  isDeleted: false,
  boundElements: null,
  updated: 1731000000000,
  link: null,
  locked: false,
};
const validDrawing = JSON.stringify({
  type: 'excalidraw',
  version: 2,
  elements: [rectangle],
  appState: {},
  files: {},
});

const drawingFile = (name: string) => new File([validDrawing], name, { type: 'application/json' });
const brokenFile = (name: string) => new File(['{"type":'], name, { type: 'application/json' });

function Home() {
  return (
    <>
      <CaptureCard />
      <FolderList />
    </>
  );
}

async function setup() {
  const rendered = await renderWorkspace(
    [
      { relativePath: 'Work', type: 'directory' },
      { relativePath: 'Idea.md', type: 'file', content: 'An idea' },
    ],
    <DiagramImportProvider>
      <Home />
    </DiagramImportProvider>,
  );
  stores.push(rendered.store);
  return { ...rendered, user: userEvent.setup() };
}

const diagramPaths = (store: WorkspaceStore) =>
  store
    .getState()
    .tree.diagrams.map((diagram) => diagram.relativePath)
    .sort();

const filesDragEvent = (files: File[]) => ({ dataTransfer: { types: ['Files'], files } });
const picker = () => screen.getByTestId<HTMLInputElement>('diagram-import-input');

describe('drag and drop overlay', () => {
  it('appears while files are dragged over Home and goes when they leave', async () => {
    await setup();
    expect(screen.queryByText('Drop to import diagrams')).not.toBeInTheDocument();
    fireEvent.dragEnter(window, filesDragEvent([drawingFile('A.excalidraw')]));
    expect(await screen.findByText('Drop to import diagrams')).toBeInTheDocument();
    expect(screen.getByText(/go into the vault root/)).toBeInTheDocument();
    fireEvent.dragLeave(window, filesDragEvent([drawingFile('A.excalidraw')]));
    await waitFor(() =>
      expect(screen.queryByText('Drop to import diagrams')).not.toBeInTheDocument(),
    );
  });

  it('ignores drags that carry no files, such as selected text', async () => {
    await setup();
    fireEvent.dragEnter(window, { dataTransfer: { types: ['text/plain'], files: [] } });
    expect(screen.queryByText('Drop to import diagrams')).not.toBeInTheDocument();
  });

  it('names the selected folder as the target', async () => {
    const { store } = await setup();
    act(() => store.getState().selectFolder('Work'));
    fireEvent.dragEnter(window, filesDragEvent([drawingFile('A.excalidraw')]));
    expect(await screen.findByText(/go into Work/)).toBeInTheDocument();
  });
});

describe('importing dropped files', () => {
  it('imports the valid file, skips the invalid one, and shows one summary toast', async () => {
    const { store } = await setup();
    fireEvent.drop(
      window,
      filesDragEvent([drawingFile('Good.excalidraw'), brokenFile('Broken.excalidraw')]),
    );
    const toast = await screen.findByText(/1 imported, 1 skipped/);
    expect(toast).toHaveTextContent(
      '1 imported, 1 skipped: Broken.excalidraw: This file is not a valid Excalidraw drawing.',
    );
    expect(diagramPaths(store)).toEqual(['Good.excalidraw']);
    // Several files at once: the list refreshes and the current screen stays.
    expect(store.getState().view).toBe('home');
    expect(screen.queryByText('Drop to import diagrams')).not.toBeInTheDocument();
  });

  it('imports into the selected folder and opens a single file', async () => {
    const { store } = await setup();
    act(() => store.getState().selectFolder('Work'));
    fireEvent.drop(window, filesDragEvent([drawingFile('Solo.excalidraw')]));
    await waitFor(() => expect(store.getState().view).toBe('diagram'));
    expect(store.getState().diagram?.summary.relativePath).toBe('Work/Solo.excalidraw');
    expect(await screen.findByText('Imported “Solo”')).toBeInTheDocument();
  });

  it('shows the message for an image without diagram data', async () => {
    const { store } = await setup();
    const photo = new File([pngImage() as BlobPart], 'photo.png', { type: 'image/png' });
    fireEvent.drop(window, filesDragEvent([photo]));
    expect(
      await screen.findByText('This image has no diagram data to import.'),
    ).toBeInTheDocument();
    expect(diagramPaths(store)).toEqual([]);
  });

  it('leaves drops over a note alone, except .excalidraw files, which would replace a drawing', async () => {
    const { store } = await setup();
    act(() => store.setState({ view: 'editor' }));
    const image = new File([new Uint8Array([1])], 'photo.png');
    const ignored = fireEvent.drop(window, filesDragEvent([image]));
    expect(ignored).toBe(true);
    expect(diagramPaths(store)).toEqual([]);

    const taken = fireEvent.drop(window, filesDragEvent([drawingFile('Dropped.excalidraw')]));
    expect(taken).toBe(false);
    await waitFor(() => expect(diagramPaths(store)).toEqual(['Dropped.excalidraw']));
  });
});

describe('the file picker', () => {
  it('imports the chosen files into the selected folder', async () => {
    const { store, user } = await setup();
    act(() => store.getState().selectFolder('Work'));
    await user.click(screen.getByRole('button', { name: 'Import diagram…' }));
    await user.upload(picker(), [drawingFile('One.excalidraw'), drawingFile('Two.excalidraw')]);
    expect(await screen.findByText('2 imported')).toBeInTheDocument();
    expect(diagramPaths(store)).toEqual(['Work/One.excalidraw', 'Work/Two.excalidraw']);
    expect(picker().value).toBe('');
  });

  it('accepts only the importable types in its file chooser', async () => {
    await setup();
    expect(picker().accept).toBe('.excalidraw,.png,.svg,image/png,image/svg+xml');
    expect(picker().multiple).toBe(true);
  });

  it('is in the folder menu as Import diagram here, and imports into that folder', async () => {
    const { user } = await setup();
    fireEvent.contextMenu(screen.getByRole('button', { name: /^Work,/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'Import diagram here' }));
    await user.upload(picker(), drawingFile('Menu.excalidraw'));
    expect(await screen.findByText('Imported “Menu”')).toBeInTheDocument();
  });
});

describe('large files', () => {
  const large = (name: string) => {
    const file = drawingFile(name);
    Object.defineProperty(file, 'size', { value: LARGE_IMPORT_BYTES + 1 });
    return file;
  };

  it('asks first, and skips the file when declined', async () => {
    const { store, user } = await setup();
    fireEvent.drop(window, filesDragEvent([large('Huge.excalidraw')]));
    expect(
      await screen.findByRole('alertdialog', { name: 'Import a large file?' }),
    ).toHaveTextContent('“Huge.excalidraw” is 50 MB');
    await user.click(screen.getByRole('button', { name: 'Skip this file' }));
    expect(await screen.findByText(/you chose not to import this large file/)).toBeInTheDocument();
    expect(diagramPaths(store)).toEqual([]);
  });

  it('imports it when confirmed', async () => {
    const { store, user } = await setup();
    fireEvent.drop(window, filesDragEvent([large('Huge.excalidraw')]));
    await user.click(await screen.findByRole('button', { name: 'Import anyway' }));
    await waitFor(() => expect(diagramPaths(store)).toEqual(['Huge.excalidraw']));
  });
});
