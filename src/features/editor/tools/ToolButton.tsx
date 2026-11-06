import type { ComponentProps } from 'react';
import type { Editor } from '@tiptap/core';
import * as Tooltip from '@radix-ui/react-tooltip';
import { shortcutLabel, type EditorCommand } from '@/features/editor/commands/editor-commands';

export function ToolButton({
  command,
  editor,
  ...props
}: { command: EditorCommand; editor: Editor } & ComponentProps<'button'>) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button
          {...props}
          type="button"
          className="editor-tool-button"
          aria-label={command.label}
          aria-pressed={command.active ? command.active(editor) : undefined}
          disabled={props.disabled || !editor.isEditable || command.enabled?.(editor) === false}
          onMouseDown={(event) => {
            event.preventDefault();
            props.onMouseDown?.(event);
          }}
        >
          <command.icon className="rich-icon" aria-hidden="true" />
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className="editor-tooltip" sideOffset={6}>
          {command.label}
          <kbd>{shortcutLabel(command.shortcut)}</kbd>
          <Tooltip.Arrow className="editor-tooltip-arrow" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
