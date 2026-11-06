import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Markdown } from '@tiptap/markdown';
import { TaskList, TaskItem } from '@tiptap/extension-list';
import { TableKit } from '@tiptap/extension-table';
import { TextColor } from './extensions/TextColor';
import { TextSize } from './extensions/TextSize';
import { Underline } from './extensions/Underline';
import { Highlight } from './extensions/Highlight';
import { ImageAttachment } from './extensions/ImageAttachment';
import { EditorShortcuts } from './extensions/EditorShortcuts';
import type { RepositoryResult } from '@/features/storage/repository-result';

export function editorExtensions(
  options: {
    resolveImage?: (
      reference: string,
    ) => RepositoryResult<string> | Promise<RepositoryResult<string>>;
  } = {},
) {
  return [
    StarterKit.configure({
      link: { openOnClick: false },
      underline: false,
      trailingNode: false,
    }),
    Placeholder.configure({ placeholder: 'Start typing...' }),
    Underline,
    Highlight,
    TextColor,
    TextSize,
    TaskList,
    TaskItem.configure({ nested: true }),
    TableKit.configure({ table: { resizable: false } }),
    ImageAttachment.configure(options.resolveImage ? { resolveSource: options.resolveImage } : {}),
    EditorShortcuts,
    Markdown,
  ];
}
