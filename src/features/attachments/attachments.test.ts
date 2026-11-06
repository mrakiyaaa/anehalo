import { describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import { InMemoryAttachmentRepository } from './InMemoryAttachmentRepository';
import { attachmentReference, resolveAttachmentReference } from './attachment-paths';
import { imageExtension, maximumImageBytes } from './image-validation';
import { editorExtensions } from '@/features/editor/editor-extensions';
import { unwrapResult } from '@/test/repository-helpers';

const png = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
describe('image attachments', () => {
  it.each(['Note.md', 'Work/Note.md', 'Work/Nested/Note.md'])(
    'saves a unique image in .attachments and inserts a relative Markdown reference from %s',
    async (notePath) => {
      const repository = new InMemoryAttachmentRepository();
      const image = unwrapResult(
        await repository.importImage({ name: 'A picture.png', bytes: png }),
      );
      const second = unwrapResult(
        await repository.importImage({ name: 'A picture.png', bytes: png }),
      );
      expect(image.vaultRelativePath).toMatch(/^\.attachments\/[\w-]+\.png$/);
      expect(second.vaultRelativePath).not.toBe(image.vaultRelativePath);
      expect(repository.files.get(image.vaultRelativePath)).toEqual(png);
      const reference = attachmentReference(notePath, image.vaultRelativePath);
      expect(resolveAttachmentReference(notePath, reference)).toBe(image.vaultRelativePath);
      const editor = new Editor({ extensions: editorExtensions(), content: '' });
      try {
        editor.commands.setImage({ src: reference, alt: image.alt });
        expect(editor.getMarkdown()).toContain(`![A picture](${reference})`);
      } finally {
        editor.destroy();
      }
    },
  );
  it('rejects oversized, unsupported and disguised SVG files', () => {
    const oversized = imageExtension(new Uint8Array(maximumImageBytes + 1));
    expect(oversized.ok).toBe(false);
    if (!oversized.ok) expect(oversized.error.message).toContain('10 MB');
    expect(imageExtension(new TextEncoder().encode('<svg onload="bad()"></svg>'))).toMatchObject({
      ok: false,
    });
    expect(imageExtension(new TextEncoder().encode('not a picture'))).toMatchObject({ ok: false });
  });
  it('surfaces write failures without returning a reference', async () => {
    const repository = new InMemoryAttachmentRepository();
    repository.failWrites = true;
    expect(await repository.importImage({ name: 'picture.png', bytes: png })).toMatchObject({
      ok: false,
      error: { code: 'io-error' },
    });
    expect(repository.files.size).toBe(0);
  });
  it('resolves saved images and reports a missing image with a typed error', async () => {
    const repository = new InMemoryAttachmentRepository();
    const image = unwrapResult(await repository.importImage({ name: 'picture.png', bytes: png }));
    expect(
      unwrapResult(await repository.sourceUrl('Work/Note.md', `../${image.vaultRelativePath}`)),
    ).toContain(image.vaultRelativePath);
    expect(await repository.sourceUrl('Note.md', '.attachments/missing.png')).toMatchObject({
      ok: false,
      error: { code: 'not-found' },
    });
  });
  it.each([
    '../../.attachments/a.png',
    '../outside.png',
    '.trash/a.png',
    '.attachments/../secret.png',
    '.attachments/a.svg',
    'C:/secret.png',
    'file:///secret.png',
  ])('rejects an unsafe reference: %s', (reference) => {
    expect(resolveAttachmentReference('Note.md', reference)).toBeNull();
  });
});
