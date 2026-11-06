import BaseImage, { type ImageOptions } from '@tiptap/extension-image';
import { isSafeLink } from '@/features/editor/sanitize-editor-html';
import {
  success,
  failure,
  describeStorageError,
  type RepositoryResult,
} from '@/features/storage/repository-result';

interface ImageAttachmentOptions extends ImageOptions {
  resolveSource: (
    reference: string,
  ) => RepositoryResult<string> | Promise<RepositoryResult<string>>;
}
export function isSafeImageReference(reference: unknown): reference is string {
  return (
    typeof reference === 'string' &&
    (/^(\.\.\/)*\.attachments\/[\w.-]+\.(png|jpe?g|gif|webp)$/i.test(reference) ||
      (/^https?:\/\//i.test(reference) && isSafeLink(reference)))
  );
}
export const ImageAttachment = BaseImage.extend<ImageAttachmentOptions>({
  addOptions() {
    return {
      ...this.parent!(),
      resolveSource: (reference) =>
        isSafeImageReference(reference)
          ? success(reference)
          : failure({ code: 'invalid-path', message: 'This image reference is not supported.' }),
    };
  },
  parseHTML() {
    return [
      {
        tag: 'img[src]',
        getAttrs: (element) => (isSafeImageReference(element.getAttribute('src')) ? null : false),
      },
    ];
  },
  renderHTML({ node }) {
    const reference: unknown = node.attrs.src;
    const source = isSafeImageReference(reference) ? reference : null;
    return source
      ? [
          'img',
          { src: source, alt: String(node.attrs.alt ?? ''), title: String(node.attrs.title ?? '') },
        ]
      : ['span', { 'data-image-unavailable': true }, 'Image unavailable'];
  },
  addNodeView() {
    return ({ node }) => {
      const container = document.createElement('figure');
      container.className = 'editor-image';
      container.contentEditable = 'false';
      let disposed = false;
      const reference: unknown = node.attrs.src;
      const showError = (
        message = 'Could not load this image. Check that its attachment is still in the vault.',
      ) => {
        if (disposed) return;
        container.replaceChildren();
        const notice = document.createElement('figcaption');
        notice.setAttribute('role', 'status');
        notice.textContent = message;
        container.append(notice);
      };
      if (!isSafeImageReference(reference)) showError();
      else
        Promise.resolve()
          .then(() => this.options.resolveSource(reference))
          .then((result) => {
            if (disposed) return;
            if (!result.ok) {
              showError(result.error.message);
              return;
            }
            const image = document.createElement('img');
            image.alt = String(node.attrs.alt ?? '');
            image.addEventListener('error', () => showError(), { once: true });
            image.src = result.value;
            container.append(image);
          })
          .catch((error: unknown) =>
            showError(describeStorageError(error, 'Could not load this image.').message),
          );
      return {
        dom: container,
        destroy: () => {
          disposed = true;
        },
      };
    };
  },
  renderMarkdown: (node) => {
    const escapeText = (value: unknown) =>
      (typeof value === 'string' ? value : '').replace(/[[\]\\]/g, '\\$&').replace(/[\r\n]/g, ' ');
    const source: unknown = node.attrs?.src;
    return isSafeImageReference(source)
      ? `![${escapeText(node.attrs?.alt)}](${source})`
      : escapeText(node.attrs?.alt ?? 'Image unavailable');
  },
});
