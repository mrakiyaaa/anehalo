import { useReducedMotion } from 'motion/react';
import { useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Tooltip } from '@/components/ui/Tooltip';
import { accentIds, accentPalette, type AccentId } from '@/features/theme/accent-palette';
import { fadeColors } from '@/features/theme/transition-theme';
import { useAccentStore } from '@/store/accent-store';

const ACCENT_FADE_MILLISECONDS = 250;

const keyOffsets: Readonly<Record<string, number>> = {
  ArrowLeft: -1,
  ArrowUp: -1,
  ArrowRight: 1,
  ArrowDown: 1,
};

/** Each swatch shows the accent as it looks in the current theme. */
function swatchStyle(id: AccentId): CSSProperties {
  const { light, dark } = accentPalette[id].modes;
  return {
    '--swatch-light': light.soft,
    '--swatch-light-ink': light.onSoft,
    '--swatch-dark': dark.soft,
    '--swatch-dark-ink': dark.onSoft,
  } as CSSProperties;
}

/**
 * The accent colours as a radio group: arrow keys move between swatches and Enter or Space
 * picks one. Picking applies at once; settings.json is updated in the background.
 */
export function AccentSwatchPicker() {
  const accent = useAccentStore((state) => state.accent);
  const setAccent = useAccentStore((state) => state.setAccent);
  const reducedMotion = useReducedMotion();
  const [focused, setFocused] = useState<AccentId>(accent);
  const swatches = useRef(new Map<AccentId, HTMLButtonElement>());

  function select(id: AccentId) {
    if (id === accent) return;
    if (reducedMotion) setAccent(id);
    else void fadeColors(() => setAccent(id), ACCENT_FADE_MILLISECONDS);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const offset = keyOffsets[event.key];
    if (offset === undefined) return;
    event.preventDefault();
    const index = accentIds.indexOf(focused);
    const next = accentIds[(index + offset + accentIds.length) % accentIds.length] ?? focused;
    setFocused(next);
    swatches.current.get(next)?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label="Accent color"
      className="accent-swatches"
      onKeyDown={handleKeyDown}
    >
      {accentIds.map((id) => {
        const { name } = accentPalette[id];
        const selected = id === accent;
        return (
          <Tooltip key={id} label={name}>
            <button
              ref={(element) => {
                if (element) swatches.current.set(id, element);
                else swatches.current.delete(id);
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`Accent color: ${name}${selected ? ', selected' : ''}`}
              tabIndex={id === focused ? 0 : -1}
              className="accent-swatch"
              data-accent={id}
              style={swatchStyle(id)}
              onFocus={() => setFocused(id)}
              onClick={() => select(id)}
            >
              {selected && <Icon name="check" />}
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}
