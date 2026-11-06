import { shortcutLabel, type EditorCommand } from '@/features/editor/commands/editor-commands';

export function CommandList({
  commands,
  selectedIndex,
  onSelect,
  listId = 'editor-commands',
}: {
  commands: readonly EditorCommand[];
  selectedIndex?: number;
  onSelect: (command: EditorCommand) => void;
  listId?: string;
}) {
  return (
    <div className="editor-command-list" role="listbox" id={listId} aria-label="Editor commands">
      {commands.length === 0 && <p className="editor-command-empty">No matching commands</p>}
      {commands.map((command, index) => (
        <button
          type="button"
          role="option"
          aria-selected={index === selectedIndex}
          key={command.id}
          id={`${listId}-${command.id}`}
          className="editor-command"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onSelect(command)}
        >
          <command.icon className="rich-icon" aria-hidden="true" />
          <span>{command.label}</span>
          <kbd>{shortcutLabel(command.shortcut)}</kbd>
        </button>
      ))}
    </div>
  );
}
