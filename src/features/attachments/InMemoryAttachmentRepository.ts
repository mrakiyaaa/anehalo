import type { AttachmentRepository, ImageAttachment, ImageInput } from './AttachmentRepository';
import { resolveAttachmentReference } from './attachment-paths';
import { imageExtension } from './image-validation';
import { failure, success, type RepositoryResult } from '@/features/storage/repository-result';
export class InMemoryAttachmentRepository implements AttachmentRepository {
  readonly files = new Map<string, Uint8Array>();
  failWrites = false;
  importImage(input: ImageInput): Promise<RepositoryResult<ImageAttachment>> {
    const extension = imageExtension(input.bytes);
    if (!extension.ok) return Promise.resolve(extension);
    if (this.failWrites)
      return Promise.resolve(
        failure({
          code: 'io-error',
          message: 'Could not save the image. Check the vault permissions and try again.',
        }),
      );
    const vaultRelativePath = `.attachments/${crypto.randomUUID()}.${extension.value}`;
    this.files.set(vaultRelativePath, input.bytes.slice());
    return Promise.resolve(success({ vaultRelativePath, alt: input.name.replace(/\.[^.]+$/, '') }));
  }
  sourceUrl(notePath: string, reference: string): Promise<RepositoryResult<string>> {
    const path = resolveAttachmentReference(notePath, reference);
    return Promise.resolve(
      path && this.files.has(path)
        ? success(`/memory/${path}`)
        : failure({
            code: 'not-found',
            message: 'This image attachment is missing from the vault.',
          }),
    );
  }
}
