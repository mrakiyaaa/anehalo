import * as Popover from '@radix-ui/react-popover';
import { Icon } from '@/components/ui/Icon';
import { Tooltip } from '@/components/ui/Tooltip';
import { AccentSwatchPicker } from './AccentSwatchPicker';

/** The title bar's palette button, with the same swatches as Settings → Appearance. */
export function AccentPopover() {
  return (
    <Popover.Root>
      <Tooltip label="Accent color" side="bottom">
        <Popover.Trigger asChild>
          <button type="button" className="window-button accent-trigger" aria-label="Accent color">
            <Icon name="palette" />
          </button>
        </Popover.Trigger>
      </Tooltip>
      <Popover.Portal>
        <Popover.Content className="accent-popover" align="end" sideOffset={6}>
          <p className="accent-popover-title">Accent color</p>
          <AccentSwatchPicker />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
