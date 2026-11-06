import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { Editor } from '@tiptap/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { editorExtensions } from '../editor-extensions';
import { filterEditorCommands, nextCommandIndex } from '../commands/slash-commands';
import { SlashMenu } from './SlashMenu';

const editors: Editor[] = [];
afterEach(() => editors.splice(0).forEach((editor) => editor.destroy()));
function setup() {
  const element = document.createElement('div');
  const editor = new Editor({ element, extensions: editorExtensions(), content: '' });
  editors.push(editor);
  render(
    <SlashMenu
      editor={editor}
      actions={{ image: vi.fn(), link: vi.fn(), color: vi.fn(), size: vi.fn(), page: vi.fn() }}
    />,
  );
  return editor;
}
describe('slash commands', () => {
  it('filters by labels and keywords without depending on case', () => {
    expect(filterEditorCommands('HEADING').map((command) => command.id)).toEqual([
      'heading1',
      'heading2',
      'heading3',
    ]);
    expect(filterEditorCommands('todo').map((command) => command.id)).toEqual(['taskList']);
    expect(filterEditorCommands('nothing matches')).toHaveLength(0);
  });
  it('wraps keyboard selection and handles an empty result list', () => {
    expect(nextCommandIndex(0, 'ArrowUp', 3)).toBe(2);
    expect(nextCommandIndex(2, 'ArrowDown', 3)).toBe(0);
    expect(nextCommandIndex(0, 'ArrowDown', 0)).toBe(0);
  });
  it('filters while typing, navigates with arrows, and replaces the query with the selected command', () => {
    const editor = setup();
    act(() => {
      editor.commands.insertContent('/heading');
    });
    const menu = screen.getByRole('listbox', { name: 'Editor commands' });
    expect(within(menu).getAllByRole('option')).toHaveLength(3);
    fireEvent.keyDown(editor.view.dom, { key: 'ArrowDown' });
    expect(within(menu).getByRole('option', { name: /Heading 2/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    fireEvent.keyDown(editor.view.dom, { key: 'Enter' });
    expect(editor.isActive('heading', { level: 2 })).toBe(true);
    expect(editor.getText()).toBe('');
    expect(screen.queryByRole('listbox')).toBeNull();
  });
  it('closes with Escape while retaining the text, then reopens for a changed query', () => {
    const editor = setup();
    act(() => {
      editor.commands.insertContent('/');
    });
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.keyDown(editor.view.dom, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(editor.getText()).toBe('/');
    act(() => {
      editor.commands.insertContent('table');
    });
    expect(screen.getByRole('option', { name: /Insert table/ })).toBeInTheDocument();
  });
  it('does not open in the middle of a paragraph or inside a code block', () => {
    const editor = setup();
    act(() => {
      editor.commands.insertContent('Text /heading');
    });
    expect(screen.queryByRole('listbox')).toBeNull();
    act(() => {
      editor.commands.setContent('/heading');
      editor.commands.setCodeBlock();
    });
    expect(screen.queryByRole('listbox')).toBeNull();
  });
  it('hides when focus leaves the editor', () => {
    const editor = setup();
    act(() => {
      editor.commands.insertContent('/');
    });
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.blur(editor.view.dom);
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});
