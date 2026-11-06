import type { Editor } from '@tiptap/core';
import { textColors, textSizes } from '@/features/editor/formatting-options';

export function FormattingPicker({
  kind,
  editor,
  onChoose,
}: {
  kind: 'color' | 'size';
  editor: Editor;
  onChoose: () => void;
}) {
  if (kind === 'size')
    return (
      <fieldset className="editor-choice-list">
        <legend>Text size</legend>
        {textSizes.map((size, index) => (
          <label className="editor-choice" key={size.name}>
            <input
              type="radio"
              name="text-size"
              value={size.name}
              checked={(editor.getAttributes('textSize').size ?? 'normal') === size.name}
              onChange={() => {
                editor.chain().focus().setTextSize(size.name).run();
                onChoose();
              }}
            />
            <span>{size.label}</span>
            <kbd>Ctrl+Shift+{index + 1}</kbd>
          </label>
        ))}
      </fieldset>
    );
  const choices = [{ name: null, label: 'Default', token: '--ink' }, ...textColors];
  return (
    <fieldset className="editor-choice-list">
      <legend>Text color</legend>
      {choices.map((color, index) => (
        <label className="editor-choice" key={color.name ?? 'default'}>
          <input
            type="radio"
            name="text-color"
            value={color.name ?? 'default'}
            checked={(editor.getAttributes('textColor').color ?? null) === color.name}
            onChange={() => {
              editor.chain().focus().setTextColor(color.name).run();
              onChoose();
            }}
          />
          <span className="editor-color-swatch" style={{ background: `var(${color.token})` }} />
          <span>{color.label}</span>
          <kbd>Ctrl+Alt+Shift+{index}</kbd>
        </label>
      ))}
    </fieldset>
  );
}
