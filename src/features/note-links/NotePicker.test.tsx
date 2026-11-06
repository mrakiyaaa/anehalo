import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Editor } from '@tiptap/core';
import { EditorContent } from '@tiptap/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotePicker } from './NotePicker';
import { filterNotes } from './filter-notes';
import { PageNotePicker } from './PageNotePicker';
import { BacklinksPanel } from './BacklinksPanel';
import { NoteNavigation } from './NoteNavigation';
import { SlashMenu } from '@/features/editor/tools/SlashMenu';
import { editorExtensions } from '@/features/editor/editor-extensions';
import { InMemoryNoteRepository } from '@/features/storage/InMemoryNoteRepository';
import { createWorkspaceStore, type WorkspaceStore } from '@/store/workspace-store';
import { WorkspaceContext } from '@/store/workspace-context';
import { unwrapResult } from '@/test/repository-helpers';
import type { NoteSummary } from '@/types/notes';

const notes: NoteSummary[] = [
  {
    title: 'Research',
    relativePath: 'Work/Research.md',
    folder: 'Work',
    modifiedAt: 30,
    snippet: '',
    searchText: '',
  },
  {
    title: 'Read soon',
    relativePath: 'Read soon.md',
    folder: null,
    modifiedAt: 20,
    snippet: '',
    searchText: '',
  },
  {
    title: 'A plan',
    relativePath: 'A plan.md',
    folder: null,
    modifiedAt: 40,
    snippet: '',
    searchText: '',
  },
];
const editors: Editor[] = [];
const stores: WorkspaceStore[] = [];
afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy());
  stores.splice(0).forEach((store) => store.getState().pauseAutoSave());
});
async function setup(content: string) {
  const source = new InMemoryNoteRepository([
    { relativePath: 'Work/Source.md', type: 'file', content },
    { relativePath: 'Target.md', type: 'file', content: '' },
  ]);
  const store = createWorkspaceStore(source);
  stores.push(store);
  await store.getState().initialize();
  unwrapResult(await store.getState().openNote('Work/Source.md'));
  const editor = new Editor({ extensions: editorExtensions(), content, contentType: 'markdown' });
  editors.push(editor);
  return { source, store, editor };
}
describe('reusable note picker', () => {
  it('ranks recent first, then exact, prefix and fuzzy title matches', () => {
    expect(filterNotes(notes, '').map((note) => note.title)).toEqual([
      'A plan',
      'Research',
      'Read soon',
    ]);
    expect(filterNotes(notes, 'read soon')[0]?.title).toBe('Read soon');
    expect(filterNotes(notes, 'RSC').map((note) => note.title)).toEqual(['Research']);
    expect(filterNotes(notes, 'work')).toEqual([]);
  });
  it('supports arrow navigation, selection and Escape', () => {
    const onChoose = vi.fn();
    const onDismiss = vi.fn();
    render(
      <NotePicker
        notes={notes}
        query=""
        onChoose={onChoose}
        onDismiss={onDismiss}
        onCreate={vi.fn()}
        onQueryChange={vi.fn()}
      />,
    );
    const input = screen.getByRole('textbox');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChoose).toHaveBeenCalledWith(notes[0]);
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalledOnce();
  });
  it('creates a new note in the current folder and inserts its link', async () => {
    const { editor, store, source } = await setup('/page Brand new');
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    render(
      <WorkspaceContext.Provider value={store}>
        <PageNotePicker
          editor={editor}
          range={{ from: 1, to: 16, query: 'page Brand new' }}
          onDismiss={vi.fn()}
        />
      </WorkspaceContext.Provider>,
    );
    fireEvent.click(screen.getByRole('option', { name: 'Create “Brand new”' }));
    await waitFor(() => expect(editor.getMarkdown()).toContain('[Brand new](Work/Brand%20new.md)'));
    expect(unwrapResult(await source.readNote('Work/Brand new.md')).content).toBe('');
  });
  it('inserts the current note too', async () => {
    const { editor, store } = await setup('/page Source');
    render(
      <WorkspaceContext.Provider value={store}>
        <PageNotePicker
          editor={editor}
          range={{ from: 1, to: 13, query: 'page Source' }}
          onDismiss={vi.fn()}
        />
      </WorkspaceContext.Provider>,
    );
    fireEvent.click(screen.getByRole('option', { name: /Source/ }));
    expect(editor.getMarkdown()).toBe('[Source](Work/Source.md)');
  });
  it('opens /page immediately, filters as you type and selects with the keyboard', async () => {
    const { editor, store } = await setup('');
    render(
      <WorkspaceContext.Provider value={store}>
        <SlashMenu
          editor={editor}
          actions={{ page: vi.fn(), color: vi.fn(), size: vi.fn(), image: vi.fn(), link: vi.fn() }}
        />
      </WorkspaceContext.Provider>,
    );
    act(() => {
      editor.commands.insertContent('/page');
    });
    expect(screen.getAllByRole('option')).toHaveLength(2);
    act(() => {
      editor.commands.insertContent(' Trgt');
    });
    expect(screen.getByRole('option', { name: /Target/ })).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(editor.view.dom, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    act(() => {
      editor.commands.insertContent(' ');
    });
    fireEvent.keyDown(editor.view.dom, { key: 'Enter' });
    expect(editor.getMarkdown()).toBe('[Target](Target.md)');
  });
  it('keeps the query and shows an explicit error when creation fails', async () => {
    const { editor, store, source } = await setup('/page New');
    source.memoryFileSystem.failNext('write');
    render(
      <WorkspaceContext.Provider value={store}>
        <PageNotePicker
          editor={editor}
          range={{ from: 1, to: 10, query: 'page New' }}
          onDismiss={vi.fn()}
        />
      </WorkspaceContext.Provider>,
    );
    fireEvent.click(screen.getByRole('option', { name: /Create/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not create');
    expect(editor.getMarkdown()).toBe('/page New');
    fireEvent.click(screen.getByRole('option', { name: /Create/ }));
    await waitFor(() => expect(editor.getMarkdown()).toBe('[New](Work/New.md)'));
  });
});

describe('note chips and backlinks', () => {
  it('opens a linked note and shows correct backlinks', async () => {
    const { editor, store } = await setup('[Target](Target.md)');
    render(
      <WorkspaceContext.Provider value={store}>
        <EditorContent editor={editor} />
        <BacklinksPanel path="Target.md" />
      </WorkspaceContext.Provider>,
    );
    expect(
      within(screen.getByText('Linked from').closest('details')!).getByRole('button', {
        name: /Source/,
      }),
    ).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Target' }));
    await waitFor(() => expect(store.getState().openDraft?.note.relativePath).toBe('Target.md'));
  });
  it('shows a broken chip after deletion, offers restore and removes links', async () => {
    const { editor, store, source } = await setup('[Target](Target.md)');
    render(
      <WorkspaceContext.Provider value={store}>
        <EditorContent editor={editor} />
      </WorkspaceContext.Provider>,
    );
    await act(async () => {
      unwrapResult(await store.getState().deleteNote('Target.md'));
    });
    const chip = screen.getByRole('button', { name: 'Target' });
    expect(chip).toHaveAttribute('data-broken', 'true');
    fireEvent.click(chip);
    fireEvent.click(await screen.findByRole('button', { name: 'Create it again' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Target' })).not.toHaveAttribute('data-broken'),
    );
    expect((await source.readNote('Target.md')).ok).toBe(true);
    await act(async () => {
      unwrapResult(await store.getState().deleteNote('Target.md'));
    });
    fireEvent.click(screen.getByRole('button', { name: 'Target' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Remove link' }));
    expect(JSON.stringify(editor.getJSON())).not.toContain('noteLink');
  });
  it('handles history shortcuts before the editor consumes arrow keys', async () => {
    const { editor, store } = await setup('');
    await store.getState().openNote('Target.md');
    render(
      <WorkspaceContext.Provider value={store}>
        <EditorContent editor={editor} />
        <NoteNavigation />
      </WorkspaceContext.Provider>,
    );
    fireEvent.keyDown(editor.view.dom, { key: 'ArrowLeft', altKey: true });
    await waitFor(() =>
      expect(store.getState().openDraft?.note.relativePath).toBe('Work/Source.md'),
    );
    await waitFor(() => expect(screen.getByRole('button', { name: 'Next note' })).toBeEnabled());
    fireEvent.keyDown(editor.view.dom, { key: 'ArrowRight', altKey: true });
    await waitFor(() => expect(store.getState().openDraft?.note.relativePath).toBe('Target.md'));
  });
});
