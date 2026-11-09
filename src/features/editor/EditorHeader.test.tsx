import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EditorHeader } from '@/features/editor/EditorHeader';
import { ExportContext } from '@/features/export/export-context';
import { InMemoryNoteRepository } from '@/features/storage/InMemoryNoteRepository';
import type { MemoryEntry } from '@/features/storage/InMemoryVaultFileSystem';
import { WorkspaceContext } from '@/store/workspace-context';
import { useWorkspaceStore } from '@/store/use-workspace-store';
import { createWorkspaceStore, type WorkspaceStore } from '@/store/workspace-store';
import { unwrapResult } from '@/test/repository-helpers';

const stores: WorkspaceStore[] = [];
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  for (const store of stores.splice(0)) store.getState().pauseAutoSave();
  vi.useRealTimers();
});

function note(relativePath: string, content = ''): MemoryEntry {
  return { relativePath, type: 'file', content, modifiedAt: 10 };
}

function Header() {
  const draft = useWorkspaceStore((state) => state.openDraft);
  return draft ? <EditorHeader draft={draft} /> : null;
}

async function setup(seed: readonly MemoryEntry[], open: string) {
  const repository = new InMemoryNoteRepository(seed);
  const store = createWorkspaceStore(repository);
  stores.push(store);
  unwrapResult(await store.getState().openNote(open));
  const rename = vi.spyOn(repository, 'renameNote');
  render(
    <WorkspaceContext.Provider value={store}>
      <ExportContext.Provider
        value={{ progress: null, run: vi.fn(), registerEditor: vi.fn(() => () => undefined) }}
      >
        <Header />
      </ExportContext.Provider>
    </WorkspaceContext.Provider>,
  );
  const files = () =>
    repository.memoryFileSystem
      .snapshot()
      .map((entry) => entry.relativePath)
      .filter((path) => path.endsWith('.md'))
      .sort();
  return { repository, store, rename, files };
}

const titleField = () => screen.getByRole<HTMLInputElement>('textbox', { name: 'Note title' });
// Fake timers and user-event's async wrapper do not mix in vitest, so drive the field directly.
const focusTitle = () => act(() => titleField().focus());
const blurTitle = () => act(() => titleField().blur());
const typeTitle = (value: string) => fireEvent.change(titleField(), { target: { value } });
const press = (key: string, init: KeyboardEventInit = {}) =>
  fireEvent.keyDown(titleField(), { key, ...init });
const wait = (milliseconds: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(milliseconds);
  });
const hint = () => document.getElementById('note-title-hint')?.textContent;

describe('typing a new note title', () => {
  it('keeps what the user types while the note is auto-saved, with no snap-back', async () => {
    const { files } = await setup(
      [note('Untitled note.md'), note('Untitled note 2.md', 'Body')],
      'Untitled note 2.md',
    );
    expect(titleField()).toHaveValue('Untitled note 2');

    focusTitle();
    typeTitle('');
    expect(titleField()).toHaveValue('');
    // Well past the auto-save delay: an empty field must stay empty and show the placeholder.
    await wait(2000);
    expect(titleField()).toHaveValue('');
    expect(titleField()).toHaveAttribute('placeholder', 'Untitled note');

    let typed = '';
    for (const character of 'Shopping list') {
      typed += character;
      typeTitle(typed);
      expect(titleField()).toHaveValue(typed);
      await wait(700);
      expect(titleField()).toHaveValue(typed);
    }
    await wait(2000);
    expect(titleField()).toHaveValue('Shopping list');
    expect(files()).toEqual(['Shopping list.md', 'Untitled note.md']);
  });

  it('does not replace a half-deleted title when the user pauses on a name that is taken', async () => {
    await setup(
      [note('Untitled note.md'), note('Untitled note 2.md', 'Body')],
      'Untitled note 2.md',
    );
    focusTitle();
    typeTitle('Untitled note');
    // "Untitled note" is another note's name: it must not be turned back into "Untitled note 2".
    await wait(2000);
    expect(titleField()).toHaveValue('Untitled note');
  });

  it('renames once per commit, not once per keystroke', async () => {
    const { rename, files } = await setup([note('Plan.md')], 'Plan.md');
    focusTitle();
    let typed = '';
    for (const character of 'Shopping list') {
      typed += character;
      typeTitle(typed);
      await wait(300);
    }
    expect(rename).not.toHaveBeenCalled();
    await wait(800);
    expect(rename).toHaveBeenCalledTimes(1);
    expect(files()).toEqual(['Shopping list.md']);
    // Leaving the field with the same text must not rename again.
    blurTitle();
    await wait(100);
    expect(rename).toHaveBeenCalledTimes(1);
  });

  it('commits on Enter and leaves the field', async () => {
    const { files, rename } = await setup([note('Plan.md')], 'Plan.md');
    focusTitle();
    typeTitle('Shopping list');
    press('Enter');
    await wait(100);
    expect(files()).toEqual(['Shopping list.md']);
    expect(rename).toHaveBeenCalledTimes(1);
    expect(titleField()).not.toHaveFocus();
    expect(titleField()).toHaveValue('Shopping list');
  });

  it('ignores Enter and Escape while an input method is composing', async () => {
    const { rename } = await setup([note('Plan.md')], 'Plan.md');
    focusTitle();
    typeTitle('සිංහල');
    press('Enter', { isComposing: true });
    press('Escape', { isComposing: true });
    await wait(100);
    expect(rename).not.toHaveBeenCalled();
    expect(titleField()).toHaveFocus();
    expect(titleField()).toHaveValue('සිංහල');
  });
});

describe('an empty title', () => {
  it('stays empty while editing and becomes "Untitled note" on blur', async () => {
    const { files } = await setup([note('Plan.md')], 'Plan.md');
    focusTitle();
    typeTitle('');
    await wait(3000);
    expect(titleField()).toHaveValue('');
    expect(files()).toEqual(['Plan.md']);
    blurTitle();
    await wait(100);
    expect(titleField()).toHaveValue('Untitled note');
    expect(files()).toEqual(['Untitled note.md']);
    expect(hint()).toBe('');
  });

  it('becomes the next free "Untitled note N" on blur when the plain name is taken', async () => {
    const { files } = await setup([note('Untitled note.md'), note('Plan.md')], 'Plan.md');
    focusTitle();
    typeTitle('');
    blurTitle();
    await wait(100);
    expect(titleField()).toHaveValue('Untitled note 2');
    expect(files()).toEqual(['Untitled note 2.md', 'Untitled note.md']);
    expect(hint()).toBe('Renamed to Untitled note 2 (name already used)');
  });
});

describe('the name the note already has', () => {
  it('is not a rename and never gets a " 2", even when another note shares its prefix', async () => {
    const { rename, files } = await setup(
      [note('Untitled note.md'), note('Untitled note 2.md')],
      'Untitled note 2.md',
    );
    focusTitle();
    typeTitle('');
    typeTitle('Untitled note 2');
    blurTitle();
    await wait(100);
    expect(rename).not.toHaveBeenCalled();
    expect(titleField()).toHaveValue('Untitled note 2');
    expect(files()).toEqual(['Untitled note 2.md', 'Untitled note.md']);
    expect(hint()).toBe('');
  });

  it('is not a rename when the quiet-field commit sees the same name', async () => {
    const { rename } = await setup([note('Plan.md')], 'Plan.md');
    focusTitle();
    typeTitle('  Plan  ');
    await wait(2000);
    expect(rename).not.toHaveBeenCalled();
  });

  it('allows a case-only change without a clash', async () => {
    const { files } = await setup([note('Plan.md'), note('Other.md')], 'Plan.md');
    focusTitle();
    typeTitle('plan');
    blurTitle();
    await wait(100);
    expect(files()).toEqual(['Other.md', 'plan.md']);
    expect(titleField()).toHaveValue('plan');
    expect(hint()).toBe('');
  });
});

describe('a name another note already uses', () => {
  it('shows the typed text while typing and resolves to " 2" only after blur, with a hint', async () => {
    const { files } = await setup([note('Shopping list.md'), note('Plan.md')], 'Plan.md');
    focusTitle();
    typeTitle('Shopping list');
    // The quiet-field commit has renamed the file, but the field keeps what was typed.
    await wait(2000);
    expect(files()).toEqual(['Shopping list 2.md', 'Shopping list.md']);
    expect(titleField()).toHaveValue('Shopping list');
    expect(hint()).toBe('');

    blurTitle();
    await wait(100);
    expect(titleField()).toHaveValue('Shopping list 2');
    expect(hint()).toBe('Renamed to Shopping list 2 (name already used)');
  });

  it('clears the hint when the user starts editing again', async () => {
    await setup([note('Shopping list.md'), note('Plan.md')], 'Plan.md');
    focusTitle();
    typeTitle('Shopping list');
    blurTitle();
    await wait(100);
    expect(hint()).toContain('Shopping list 2');
    focusTitle();
    expect(hint()).toBe('');
  });

  it('explains removed characters', async () => {
    const { files } = await setup([note('Plan.md')], 'Plan.md');
    focusTitle();
    typeTitle('Plan/B: now?');
    blurTitle();
    await wait(100);
    expect(files()).toEqual(['PlanB now.md']);
    expect(titleField()).toHaveValue('PlanB now');
    expect(hint()).toBe('Renamed to PlanB now (invalid characters removed)');
  });
});

describe('Escape', () => {
  it('restores the current name and renames nothing', async () => {
    const { rename, files } = await setup([note('Plan.md')], 'Plan.md');
    focusTitle();
    typeTitle('Something else');
    press('Escape');
    expect(titleField()).toHaveValue('Plan');
    await wait(3000);
    expect(titleField()).toHaveValue('Plan');
    expect(rename).not.toHaveBeenCalled();
    blurTitle();
    await wait(100);
    expect(titleField()).toHaveValue('Plan');
    expect(files()).toEqual(['Plan.md']);
  });

  it('renames back when the field was quiet long enough for a rename to happen first', async () => {
    const { files } = await setup([note('Plan.md')], 'Plan.md');
    focusTitle();
    typeTitle('Draft');
    await wait(2000);
    expect(files()).toEqual(['Draft.md']);
    press('Escape');
    expect(titleField()).toHaveValue('Plan');
    await wait(100);
    expect(files()).toEqual(['Plan.md']);
    expect(titleField()).toHaveValue('Plan');
  });
});

describe('a title that cannot be used', () => {
  it('keeps the text, marks the field invalid, and recovers on the next valid name', async () => {
    const { files } = await setup([note('Plan.md')], 'Plan.md');
    focusTitle();
    typeTitle('CON');
    blurTitle();
    await wait(100);
    expect(titleField()).toHaveValue('CON');
    expect(titleField()).toHaveAttribute('aria-invalid', 'true');
    expect(files()).toEqual(['Plan.md']);
    focusTitle();
    typeTitle('Valid');
    blurTitle();
    await wait(100);
    expect(titleField()).toHaveAttribute('aria-invalid', 'false');
    expect(files()).toEqual(['Valid.md']);
  });
});

describe('body and navigation while the title is being edited', () => {
  it('keeps auto-saving the body without committing the title early', async () => {
    const { repository, store, files } = await setup([note('Plan.md', 'Old body')], 'Plan.md');
    const identifier = store.getState().openDraft!.identifier;
    focusTitle();
    typeTitle('Draft title');
    store.getState().updateNoteContent(identifier, 'New body');
    await wait(500);
    // The body saved on its own schedule; the title is still only text in the field.
    expect(unwrapResult(await repository.readNote('Plan.md')).content).toBe('New body');
    expect(files()).toEqual(['Plan.md']);
    expect(titleField()).toHaveValue('Draft title');

    await wait(400);
    expect(files()).toEqual(['Draft title.md']);
    expect(unwrapResult(await repository.readNote('Draft title.md')).content).toBe('New body');
    expect(titleField()).toHaveValue('Draft title');
  });

  it('commits a half-typed title when the user opens another note', async () => {
    const { store, files } = await setup([note('Plan.md'), note('Other.md')], 'Plan.md');
    focusTitle();
    typeTitle('Half typed');
    await act(async () => {
      unwrapResult(await store.getState().openNote('Other.md'));
    });
    expect(files()).toEqual(['Half typed.md', 'Other.md']);
    // The field now belongs to the other note and carries nothing over.
    expect(titleField()).toHaveValue('Other');
  });

  it('commits a half-typed title when the app saves everything, such as on close', async () => {
    const { store, files } = await setup([note('Plan.md')], 'Plan.md');
    focusTitle();
    typeTitle('On close');
    await act(async () => {
      unwrapResult(await store.getState().flushNotes());
    });
    expect(files()).toEqual(['On close.md']);
    expect(titleField()).toHaveValue('On close');
  });
});

describe('links to a renamed note', () => {
  it('are updated when the title is committed from the field', async () => {
    const { repository, store } = await setup(
      [note('Source.md', 'See [Plan](Plan.md) and [again](Plan.md)'), note('Plan.md')],
      'Plan.md',
    );
    focusTitle();
    typeTitle('Roadmap');
    press('Enter');
    await wait(200);
    expect(unwrapResult(await repository.readNote('Source.md')).content).toBe(
      'See [Roadmap](Roadmap.md) and [again](Roadmap.md)',
    );
    expect(store.getState().openDraft?.note.relativePath).toBe('Roadmap.md');
  });
});
