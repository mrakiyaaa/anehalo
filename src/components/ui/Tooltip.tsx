import * as RadixTooltip from '@radix-ui/react-tooltip';
import type { ReactElement } from 'react';

interface TooltipProps {
  readonly label: string;
  readonly side?: 'top' | 'right' | 'bottom' | 'left';
  /** One focusable element, which receives the trigger's props. */
  readonly children: ReactElement;
}

/** A short label shown on hover and keyboard focus. */
export function Tooltip({ label, side = 'top', children }: TooltipProps) {
  return (
    <RadixTooltip.Provider delayDuration={300}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content className="app-tooltip" side={side} sideOffset={6}>
            {label}
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}
