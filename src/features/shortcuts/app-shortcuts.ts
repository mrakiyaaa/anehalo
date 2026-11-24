import { isTypingInDiagramText } from './typing-target';

/** A fixed shortcut that works inside the window, as opposed to the configurable global ones. */
export interface AppShortcut {
  readonly label: string;
  readonly keys: string;
  readonly matches: (event: KeyboardEvent) => boolean;
}

interface Modifiers {
  readonly ctrl?: boolean;
  readonly alt?: boolean;
}

function withModifiers(event: KeyboardEvent, { ctrl = false, alt = false }: Modifiers) {
  return (event.ctrlKey || event.metaKey) === ctrl && event.altKey === alt && !event.shiftKey;
}

export const appShortcuts = {
  search: {
    label: 'Search notes and diagrams',
    keys: 'Ctrl+K',
    matches: (event) => withModifiers(event, { ctrl: true }) && event.key.toLowerCase() === 'k',
  },
  back: {
    label: 'Back',
    keys: 'Alt+Left',
    matches: (event) => withModifiers(event, { alt: true }) && event.key === 'ArrowLeft',
  },
  forward: {
    label: 'Forward',
    keys: 'Alt+Right',
    matches: (event) => withModifiers(event, { alt: true }) && event.key === 'ArrowRight',
  },
  // Ctrl+B is bold in the editor, so the sidebar uses Ctrl+\ (the physical backslash key).
  toggleSidebar: {
    label: 'Collapse or expand the sidebar',
    keys: 'Ctrl+\\',
    matches: (event) => withModifiers(event, { ctrl: true }) && event.code === 'Backslash',
  },
} as const satisfies Record<string, AppShortcut>;

/** Typing diagram text, or a dialog or popover that has the keyboard, keeps app shortcuts quiet. */
export function isShortcutBlocked(event: KeyboardEvent): boolean {
  return (
    isTypingInDiagramText(event.target) ||
    document.querySelector('[role="dialog"], [role="alertdialog"]') !== null
  );
}
