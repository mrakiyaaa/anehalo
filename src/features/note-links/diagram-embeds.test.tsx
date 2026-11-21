import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Editor } from '@tiptap/core';
import { EditorContent } from '@tiptap/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DiagramRepository } from '@/features/diagrams/DiagramRepository';
import type { DiagramScene } from '@/features/diagrams/diagram-codec';
import { editorExtensions } from '@/features/editor/editor-extensions';
import type { MemoryEntry } from '@/features/storage/InMemoryVaultFileSystem';
import { MemoryThumbnailFiles } from '@/features/thumbnails/thumbnail-files';
import { ThumbnailCache, type Thumbnail } from '@/features/thumbnails/thumbnail-cache';
import { ThumbnailService } from '@/features/thumbnails/thumbnail-service';
import type { WorkspaceStore } from '@/store/workspace-store';
import { diagramFile, editOutsideAnehalo, fakeDiagramCodec } from '@/test/diagram-helpers';
import { unwrapResult } from '@/test/repository-helpers';
import { renderWorkspace } from '@/test/workspace-render';
import { BacklinksPanel } from './BacklinksPanel';
import { DiagramEmbedPicker } from './DiagramEmbedPicker';
import { PageNotePicker } from './PageNotePicker';

const planNote = 'Intro\n\n![Flow](Flow.excalidraw)';
const vault: readonly MemoryEntry[] = [
  { relativePath: 'Work', type: 'directory' },
  { relativePath: 'Work/Plan.md', type: 'file', content: planNote },
  { relativePath: 'Flow.excalidraw', type: 'file', content: diagramFile('start') },
  { relativePath: 'Empty.excalidraw', type: 'file', content: diagramFile() },
  { relativePath: 'Broken.excalidraw', type: 'file', content: '{"type":"excal' },
  {
    relativePath: 'Map.excalidraw',
    type: 'file',
    content: JSON.stringify({
      type: 'excalidraw',
      elements: [{ id: 'a', type: 'rectangle', link: 'Work/Plan.md' }],
    }),
  },
];

/** Names the drawn elements in the image bytes, so a redraw after an edit can be told apart. */
const render = vi.fn((scene: DiagramScene): Promise<Thumbnail> => {
  const ids = scene.elements.map(({ id }) => id);
  return Promise.resolve(
    ids.length === 0
      ? { state: 'empty' }
      : { state: 'image', bytes: new TextEncoder().encode(ids.join(',')), mimeType: 'image/png' },
  );
});

const editors: Editor[] = [];
const stores: WorkspaceStore[] = [];
let objectUrls = 0;
beforeEach(() => {
  objectUrls = 0;
  URL.createObjectURL = () => `blob:preview-${(objectUrls += 1)}`;
  URL.revokeObjectURL = () => undefined;
});
afterEach(() => {
  render.mockClear();
  editors.splice(0).forEach((editor) => editor.destroy());
  stores.splice(0).forEach((store) => store.getState().pauseAutoSave());
});

function editorFor(content: string) {
  const editor = new Editor({ extensions: editorExtensions(), content, contentType: 'markdown' });
  editors.push(editor);
  return editor;
}

async function setup(ui: (editor: Editor) => React.ReactNode, content = '') {
  const editor = editorFor(content);
  const rendered = await renderWorkspace(vault, ui(editor));
  stores.push(rendered.store);
  rendered.store.setState({
    thumbnails: new ThumbnailService({
      cache: new ThumbnailCache(new MemoryThumbnailFiles(), 'Memory/Anehalo'),
      diagrams: new DiagramRepository(rendered.repository.storage, () =>
        Promise.resolve(fakeDiagramCodec),
      ),
      render,
      waitForIdle: () => Promise.resolve(),
    }),
  });
  return { ...rendered, editor, user: userEvent.setup() };
}

const embed = (title: string) => {
  const caption = screen
    .getAllByRole('figure')
    .find((figure) => figure.textContent?.endsWith(title));
  if (!caption) throw new Error(`No embed titled ${title}`);
  return caption;
};

describe('diagram embeds in a note', () => {
  it('shows ready, empty, corrupt and missing previews', async () => {
    await setup(
      (editor) => <EditorContent editor={editor} />,
      [
        '![Flow](Flow.excalidraw)',
        '![Empty](Empty.excalidraw)',
        '![Broken](Broken.excalidraw)',
        '![Gone](Gone.excalidraw)',
      ].join('\n\n'),
    );
    expect(
      await within(embed('Flow')).findByRole('img', { name: 'Preview of Flow' }),
    ).toBeVisible();
    expect(await within(embed('Empty')).findByText('Empty diagram')).toBeVisible();
    expect(await within(embed('Broken')).findByText('Diagram file is damaged')).toBeVisible();
    expect(await within(embed('Gone')).findByText('Diagram not found')).toBeVisible();
  });

  // Clicks inside the editor use fireEvent: a full pointer sequence makes ProseMirror measure
  // the layout, which jsdom does not have.
  it('opens the diagram when the preview is clicked or activated with the keyboard', async () => {
    const { store } = await setup(
      (editor) => <EditorContent editor={editor} />,
      '![Flow](Flow.excalidraw)',
    );
    const preview = await screen.findByRole('button', { name: 'Open diagram Flow' });
    fireEvent.click(preview);
    await waitFor(() => expect(store.getState().view).toBe('diagram'));
    unwrapResult(await store.getState().goHome());
    fireEvent.keyDown(preview, { key: 'Enter' });
    await waitFor(() => expect(store.getState().view).toBe('diagram'));
  });

  it('says a trashed diagram is in the trash and restores it', async () => {
    const { store, files } = await setup(
      (editor) => <EditorContent editor={editor} />,
      '![Flow](Flow.excalidraw)',
    );
    await screen.findByRole('img', { name: 'Preview of Flow' });
    unwrapResult(await store.getState().trashDiagram('Flow.excalidraw'));
    expect(await within(embed('Flow')).findByText('Diagram is in trash')).toBeVisible();

    fireEvent.click(within(embed('Flow')).getByRole('button', { name: 'Restore' }));
    expect(
      await within(embed('Flow')).findByRole('img', { name: 'Preview of Flow' }),
    ).toBeVisible();
    expect(await files.metadata('Flow.excalidraw')).not.toBeNull();
  });

  it('redraws after the diagram changes, and serves an unchanged one from the cache', async () => {
    const { store, files } = await setup(
      (editor) => <EditorContent editor={editor} />,
      '![Flow](Flow.excalidraw)',
    );
    const image = await screen.findByRole('img', { name: 'Preview of Flow' });
    const first = image.getAttribute('src');
    expect(render).toHaveBeenCalledTimes(1);

    await editOutsideAnehalo(files, 'Flow.excalidraw', diagramFile('start', 'end'));
    await store.getState().refreshTree();
    await waitFor(() =>
      expect(screen.getByRole('img', { name: 'Preview of Flow' })).not.toHaveAttribute(
        'src',
        first ?? '',
      ),
    );
    expect(render).toHaveBeenCalledTimes(2);
    const drawn = render.mock.calls.at(-1)?.[0].elements.map(({ id }) => id);
    expect(drawn).toEqual(['start', 'end']);

    // A second preview of the unchanged file comes from the cache without drawing.
    const thumbnails = store.getState().thumbnails;
    if (!thumbnails) throw new Error('No thumbnail service');
    expect((await thumbnails.thumbnail('Flow.excalidraw', 'preview'))?.state).toBe('image');
    expect(render).toHaveBeenCalledTimes(2);
  });
});

describe('/page and /diagram pickers', () => {
  it('/page lists diagrams next to notes and links the chosen diagram', async () => {
    const onDismiss = vi.fn();
    const { editor, user } = await setup((current) => (
      <PageNotePicker editor={current} onDismiss={onDismiss} />
    ));
    expect(screen.getByRole('option', { name: /Plan/ })).toBeVisible();
    await user.click(screen.getByRole('option', { name: /Flow/ }));
    expect(editor.getMarkdown().trim()).toBe('[Flow](Flow.excalidraw)');
    expect(onDismiss).toHaveBeenCalled();
  });

  it('/diagram embeds an existing diagram', async () => {
    const { editor, user } = await setup((current) => (
      <DiagramEmbedPicker editor={current} onDismiss={vi.fn()} />
    ));
    expect(screen.queryByRole('option', { name: /Plan/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: /Flow/ }));
    expect(editor.getMarkdown().trim()).toBe('![Flow](Flow.excalidraw)');
  });

  it("/diagram creates a new diagram in the note's folder and keeps the note open", async () => {
    const { editor, store, files, user } = await setup((current) => (
      <DiagramEmbedPicker editor={current} onDismiss={vi.fn()} />
    ));
    unwrapResult(await store.getState().openNote('Work/Plan.md'));
    await user.click(screen.getByRole('option', { name: /New diagram/ }));
    await waitFor(() =>
      expect(editor.getMarkdown()).toMatch(/^!\[[^\]]+\]\(Work\/[^)]+\.excalidraw\)/),
    );
    const created = store.getState().tree.diagrams.find((item) => item.folder === 'Work');
    expect(created).toBeDefined();
    expect(await files.metadata(created?.relativePath ?? '')).not.toBeNull();
    expect(store.getState().view).toBe('editor');
    expect(store.getState().openDraft?.note.relativePath).toBe('Work/Plan.md');
  });
});

describe('backlinks between notes and diagrams', () => {
  it('lists the note that embeds a diagram on the diagram screen panel', async () => {
    const { store } = await setup(() => <BacklinksPanel path="Flow.excalidraw" defaultOpen />);
    await store.getState().initialize();
    const panel = screen.getByRole('group');
    expect(await within(panel).findByRole('button', { name: /Plan/ })).toBeVisible();
  });

  it('lists a diagram whose element links to the note', async () => {
    const { store } = await setup(() => <BacklinksPanel path="Work/Plan.md" />);
    await store.getState().initialize();
    const panel = screen.getByRole('group');
    expect(await within(panel).findByRole('button', { name: /Map/ })).toBeVisible();
  });
});
