import { Copy, FileDown, FileText } from 'lucide-react';
import type { ExportAction } from './export-types';

export const exportActions = [
  { action: 'copy-markdown', label: 'Copy as Markdown', icon: Copy, shortcut: 'Ctrl+Shift+C' },
  { action: 'copy-rich-text', label: 'Copy as rich text', icon: Copy },
  { action: 'save-markdown', label: 'Save as Markdown (.md)', icon: FileText },
  { action: 'save-pdf', label: 'Save as PDF', icon: FileDown },
] as const satisfies readonly {
  action: ExportAction;
  label: string;
  icon: typeof Copy;
  shortcut?: string;
}[];
