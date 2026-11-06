import { Extension } from '@tiptap/core';
import { editorCommands, type EditorActions } from '@/features/editor/commands/editor-commands';
import { textColors, textSizes } from '@/features/editor/formatting-options';

declare module '@tiptap/core' {
  interface EditorEvents {
    formattingAction: { action: keyof EditorActions };
  }
}
export const EditorShortcuts = Extension.create({
  name: 'editorShortcuts',
  priority: 1100,
  addKeyboardShortcuts() {
    const request = (action: keyof EditorActions) =>
      this.editor.emit('formattingAction', { action });
    const actions: EditorActions = {
      link: () => request('link'),
      image: () => request('image'),
      color: () => request('color'),
      size: () => request('size'),
    };
    const shortcuts: Record<string, () => boolean> = {};
    for (const command of editorCommands) {
      shortcuts[command.shortcut] = () => {
        if (!this.editor.isEditable || command.enabled?.(this.editor) === false) return false;
        command.run(this.editor, actions);
        return true;
      };
    }
    shortcuts['Mod-Shift-z'] = () => this.editor.commands.redo();
    shortcuts['Mod-Alt-Shift-0'] = () => this.editor.commands.setTextColor(null);
    textColors.forEach((color, index) => {
      shortcuts[`Mod-Alt-Shift-${index + 1}`] = () => this.editor.commands.setTextColor(color.name);
    });
    textSizes.forEach((size, index) => {
      shortcuts[`Mod-Shift-${index + 1}`] = () => this.editor.commands.setTextSize(size.name);
    });
    return shortcuts;
  },
});
