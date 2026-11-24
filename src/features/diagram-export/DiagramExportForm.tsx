import { Copy, FileDown, FileImage, FileJson } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import {
  diagramExportScales,
  type DiagramExportOptions,
  type DiagramExportScale,
  type DiagramExportTheme,
  type DiagramImageFormat,
} from './diagram-export-options';
import type { DiagramExportAction } from './DiagramExportService';

/** What the person chose; the button turns it into a request with the selected element ids. */
export interface DiagramExportChoice {
  readonly action: DiagramExportAction;
  readonly options: DiagramExportOptions;
  readonly selectionOnly: boolean;
}

interface DiagramExportFormProps {
  /** The options remembered from the last export. */
  readonly initialOptions: DiagramExportOptions;
  /** How many elements are selected on the canvas; "Selection only" needs at least one. */
  readonly selectedCount: number;
  readonly busy: boolean;
  readonly onRun: (choice: DiagramExportChoice) => void;
}

function Choice<Value extends string | number>({
  legend,
  name,
  value,
  choices,
  disabled = false,
  onChange,
}: {
  legend: string;
  name: string;
  value: Value;
  choices: readonly { value: Value; label: string }[];
  disabled?: boolean;
  onChange: (value: Value) => void;
}) {
  return (
    <fieldset className="diagram-export-field" disabled={disabled}>
      <legend>{legend}</legend>
      <div className="diagram-export-choices">
        {choices.map((choice) => (
          <label key={choice.value}>
            <input
              type="radio"
              name={name}
              checked={choice.value === value}
              onChange={() => onChange(choice.value)}
            />
            <span>{choice.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Toggle({
  label,
  checked,
  disabled = false,
  hint,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  hint?: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="diagram-export-toggle" data-disabled={disabled || undefined}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        {label}
        {hint && <small>{hint}</small>}
      </span>
    </label>
  );
}

const formatChoices: readonly { value: DiagramImageFormat; label: string }[] = [
  { value: 'png', label: 'PNG' },
  { value: 'svg', label: 'SVG' },
];
const themeChoices: readonly { value: DiagramExportTheme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];
const scaleChoices = diagramExportScales.map((scale) => ({ value: scale, label: `${scale}×` }));

/** The options and actions of the diagram's Export popover. */
export function DiagramExportForm({
  initialOptions,
  selectedCount,
  busy,
  onRun,
}: DiagramExportFormProps) {
  const identifier = useId();
  const [options, setOptions] = useState(initialOptions);
  const [selectionOnly, setSelectionOnly] = useState(false);
  const hasSelection = selectedCount > 0;
  const change = (patch: Partial<DiagramExportOptions>) =>
    setOptions((current) => ({ ...current, ...patch }));
  const run = (action: DiagramExportAction) =>
    onRun({
      action,
      options,
      // Offered only while elements are selected, so a stale choice never narrows an export.
      selectionOnly: selectionOnly && hasSelection,
    });
  const actions: readonly { action: DiagramExportAction; label: string; icon: ReactNode }[] = [
    {
      action: 'save-image',
      label: `Save as ${options.format.toUpperCase()}…`,
      icon: <FileDown size={15} aria-hidden="true" />,
    },
    {
      action: 'copy-png',
      label: 'Copy PNG to clipboard',
      icon: <Copy size={15} aria-hidden="true" />,
    },
    {
      action: 'copy-svg',
      label: 'Copy SVG to clipboard',
      icon: <FileImage size={15} aria-hidden="true" />,
    },
    {
      action: 'save-copy',
      label: 'Save a copy as .excalidraw…',
      icon: <FileJson size={15} aria-hidden="true" />,
    },
  ];
  return (
    <div className="diagram-export-form">
      <p className="accent-popover-title">Export diagram</p>
      <Choice
        legend="Format"
        name={`${identifier}-format`}
        value={options.format}
        choices={formatChoices}
        onChange={(format) => change({ format })}
      />
      <Choice
        legend="Theme"
        name={`${identifier}-theme`}
        value={options.theme}
        choices={themeChoices}
        onChange={(theme) => change({ theme })}
      />
      <Choice
        legend="Scale"
        name={`${identifier}-scale`}
        value={options.scale}
        choices={scaleChoices}
        disabled={options.format !== 'png'}
        onChange={(scale: DiagramExportScale) => change({ scale })}
      />
      <Toggle
        label="Background"
        checked={options.background}
        onChange={(background) => change({ background })}
      />
      <Toggle
        label="Embed scene"
        hint="Lets Anehalo or excalidraw.com open the image as a drawing again"
        checked={options.embedScene}
        onChange={(embedScene) => change({ embedScene })}
      />
      <Toggle
        label="Selection only"
        {...(hasSelection ? { hint: `${selectedCount} selected` } : { hint: 'Nothing selected' })}
        checked={selectionOnly && hasSelection}
        disabled={!hasSelection}
        onChange={setSelectionOnly}
      />
      <div className="diagram-export-actions">
        {actions.map(({ action, label, icon }) => (
          <button
            key={action}
            type="button"
            className="diagram-export-action"
            disabled={busy}
            onClick={() => run(action)}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
