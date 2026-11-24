import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { defaultDiagramExportOptions, type DiagramExportOptions } from './diagram-export-options';
import { DiagramExportForm, type DiagramExportChoice } from './DiagramExportForm';

function setup(
  props: { initialOptions?: DiagramExportOptions; selectedCount?: number; busy?: boolean } = {},
) {
  const onRun = vi.fn<(choice: DiagramExportChoice) => void>();
  render(
    <DiagramExportForm
      initialOptions={props.initialOptions ?? defaultDiagramExportOptions}
      selectedCount={props.selectedCount ?? 0}
      busy={props.busy ?? false}
      onRun={onRun}
    />,
  );
  return { onRun, user: userEvent.setup() };
}

const radio = (name: string) => screen.getByRole<HTMLInputElement>('radio', { name });
const checkbox = (name: RegExp) => screen.getByRole<HTMLInputElement>('checkbox', { name });

describe('Export popover', () => {
  it('offers format, theme, scale, background, embed scene and selection', () => {
    setup();
    expect(radio('PNG')).toBeChecked();
    expect(radio('SVG')).not.toBeChecked();
    expect(radio('Light')).toBeChecked();
    expect(radio('Dark')).not.toBeChecked();
    for (const scale of ['1×', '2×', '3×']) expect(radio(scale)).toBeEnabled();
    expect(radio('2×')).toBeChecked();
    expect(checkbox(/^Background/)).toBeChecked();
    expect(checkbox(/^Embed scene/)).not.toBeChecked();
    expect(checkbox(/^Selection only/)).toBeInTheDocument();
  });

  it('shows the options remembered from the last export', () => {
    setup({
      initialOptions: {
        format: 'svg',
        background: false,
        theme: 'dark',
        scale: 3,
        embedScene: true,
      },
    });
    expect(radio('SVG')).toBeChecked();
    expect(radio('Dark')).toBeChecked();
    expect(radio('3×')).toBeChecked();
    expect(checkbox(/^Background/)).not.toBeChecked();
    expect(checkbox(/^Embed scene/)).toBeChecked();
  });

  it('disables Selection only until something is selected, and says how many are', async () => {
    const { user } = setup({ selectedCount: 0 });
    const selection = checkbox(/^Selection only/);
    expect(selection).toBeDisabled();
    expect(selection).not.toBeChecked();
    expect(screen.getByText('Nothing selected')).toBeInTheDocument();
    await user.click(selection);
    expect(selection).not.toBeChecked();
  });

  it('enables Selection only with a selection', async () => {
    const { user, onRun } = setup({ selectedCount: 4 });
    const selection = checkbox(/^Selection only/);
    expect(selection).toBeEnabled();
    expect(screen.getByText('4 selected')).toBeInTheDocument();
    await user.click(selection);
    await user.click(screen.getByRole('button', { name: 'Save as PNG…' }));
    expect(onRun).toHaveBeenCalledWith(expect.objectContaining({ selectionOnly: true }));
  });

  it('turns scale off for SVG, which has no pixel size', async () => {
    const { user } = setup();
    await user.click(radio('SVG'));
    for (const scale of ['1×', '2×', '3×']) expect(radio(scale)).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save as SVG…' })).toBeInTheDocument();
  });

  it('runs the chosen action with the chosen options', async () => {
    const { user, onRun } = setup();
    await user.click(radio('Dark'));
    await user.click(radio('3×'));
    await user.click(checkbox(/^Background/));
    await user.click(checkbox(/^Embed scene/));
    await user.click(screen.getByRole('button', { name: 'Save as PNG…' }));
    expect(onRun).toHaveBeenLastCalledWith({
      action: 'save-image',
      options: { format: 'png', theme: 'dark', scale: 3, background: false, embedScene: true },
      selectionOnly: false,
    });
    await user.click(screen.getByRole('button', { name: 'Copy PNG to clipboard' }));
    expect(onRun).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'copy-png' }));
    await user.click(screen.getByRole('button', { name: 'Copy SVG to clipboard' }));
    expect(onRun).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'copy-svg' }));
    await user.click(screen.getByRole('button', { name: 'Save a copy as .excalidraw…' }));
    expect(onRun).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'save-copy' }));
  });

  it('disables every action while another export is running', () => {
    setup({ busy: true });
    for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled();
  });
});
