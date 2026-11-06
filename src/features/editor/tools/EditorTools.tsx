import type { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import * as Popover from '@radix-ui/react-popover';
import * as Tooltip from '@radix-ui/react-tooltip';
import {
  editorCommands,
  type EditorActions,
  type EditorCommand,
} from '@/features/editor/commands/editor-commands';
import { ToolButton } from './ToolButton';
import { FormattingPicker } from './FormattingPicker';
import { LinkForm } from './LinkForm';
import { CommandList } from './CommandList';

export function EditorTools({
  editor,
  disabled,
  actions,
  openPopover,
  setOpenPopover,
}: {
  editor: Editor;
  disabled: boolean;
  actions: EditorActions;
  openPopover: string | null;
  setOpenPopover: (value: string | null) => void;
}) {
  useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      document: current.state.doc,
      selection: current.state.selection,
      marks: current.state.storedMarks,
      editable: current.isEditable,
    }),
  });
  const close = () => setOpenPopover(null);
  const run = (command: EditorCommand) => {
    if (disabled || !editor.isEditable) return;
    close();
    command.run(editor, actions);
  };

  function control(
    command: EditorCommand,
    location: 'toolbar' | 'bubble',
    menu?: readonly EditorCommand[],
  ) {
    const identifier = `${location}:${command.id}`;
    const isPicker = command.id === 'color' || command.id === 'size' || command.id === 'link';
    if (!isPicker && !menu)
      return (
        <ToolButton
          key={identifier}
          command={command}
          editor={editor}
          disabled={disabled}
          onClick={() => run(command)}
        />
      );
    return (
      <Popover.Root
        key={identifier}
        open={openPopover === identifier}
        onOpenChange={(open) => setOpenPopover(open ? identifier : null)}
      >
        <Popover.Trigger asChild>
          <ToolButton command={command} editor={editor} disabled={disabled} />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className="editor-popover"
            inert={disabled}
            sideOffset={8}
            align="start"
            collisionPadding={10}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              editor.commands.focus();
            }}
            onKeyDown={(event) => {
              if (!menu || !['ArrowDown', 'ArrowUp'].includes(event.key)) return;
              const options = Array.from(
                event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"]'),
              );
              const current = options.indexOf(document.activeElement as HTMLButtonElement);
              options[
                (current + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length
              ]?.focus();
              event.preventDefault();
            }}
          >
            {menu ? (
              <CommandList
                commands={menu.filter((item) => item.enabled?.(editor) !== false)}
                onSelect={run}
                listId={`${location}-${command.id}-options`}
              />
            ) : command.id === 'link' ? (
              <LinkForm editor={editor} onChoose={close} />
            ) : (
              <FormattingPicker
                kind={command.id === 'color' ? 'color' : 'size'}
                editor={editor}
                onChoose={close}
              />
            )}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    );
  }
  const paragraph = editorCommands.find((command) => command.id === 'paragraph');
  const table = editorCommands.find((command) => command.id === 'table');
  return (
    <Tooltip.Provider delayDuration={350}>
      <div className="editor-toolbar" role="toolbar" aria-label="Formatting tools">
        <div className="editor-tool-group" role="group" aria-label="Text formatting">
          {editorCommands
            .filter((command) => command.group === 'text')
            .map((command) => control(command, 'toolbar'))}
        </div>
        <div className="editor-tool-group" role="group" aria-label="Blocks and insert">
          {paragraph &&
            control(
              {
                ...paragraph,
                id: 'blocks',
                label: 'Blocks',
                active: () => !editor.isActive('paragraph'),
              },
              'toolbar',
              editorCommands.filter((command) => command.group === 'blocks'),
            )}
          {editorCommands
            .filter((command) => command.group === 'insert' && command.id !== 'table')
            .map((command) => control(command, 'toolbar'))}
          {table &&
            control(
              {
                ...table,
                label: 'Table',
                enabled: () => true,
                active: (current) => current.isActive('table'),
              },
              'toolbar',
              editorCommands.filter(
                (command) => command.id === 'table' || command.group === 'table',
              ),
            )}
        </div>
        <div className="editor-tool-group" role="group" aria-label="History">
          {editorCommands
            .filter((command) => command.group === 'history')
            .map((command) => control(command, 'toolbar'))}
        </div>
      </div>
      <BubbleMenu
        editor={editor}
        options={{ placement: 'top', offset: 8 }}
        shouldShow={({ editor: current, state }) =>
          current.isEditable &&
          !state.selection.empty &&
          !current.isActive('image') &&
          !current.isActive('codeBlock')
        }
      >
        <div className="editor-bubble-menu" role="toolbar" aria-label="Selection formatting">
          {editorCommands
            .filter((command) =>
              ['bold', 'italic', 'underline', 'strike', 'color', 'link'].includes(command.id),
            )
            .map((command) => control(command, 'bubble'))}
        </div>
      </BubbleMenu>
    </Tooltip.Provider>
  );
}
