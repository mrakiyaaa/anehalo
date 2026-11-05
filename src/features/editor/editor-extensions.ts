import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Markdown } from '@tiptap/markdown';

export function editorExtensions() {
  return [
    StarterKit.configure({
      link: { openOnClick: false },
      underline: false,
      strike: false,
      trailingNode: false,
    }),
    Placeholder.configure({ placeholder: 'Start typing...' }),
    Markdown,
  ];
}
