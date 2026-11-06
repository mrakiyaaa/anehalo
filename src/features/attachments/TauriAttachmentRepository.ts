import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { TauriVaultFileSystem } from '@/features/storage/TauriVaultFileSystem';
import { VaultFileService } from '@/features/storage/VaultFileService';
import {
  describeStorageError,
  failure,
  success,
  storageFailure,
  type RepositoryResult,
} from '@/features/storage/repository-result';
import type { AttachmentRepository, ImageAttachment, ImageInput } from './AttachmentRepository';
import { resolveAttachmentReference } from './attachment-paths';
import { imageExtension } from './image-validation';
export class TauriAttachmentRepository implements AttachmentRepository {
  private readonly files: TauriVaultFileSystem;
  private scopePreparation: Promise<void> | null = null;
  constructor(private readonly vaultPath: string) {
    this.files = new TauriVaultFileSystem(() => Promise.resolve(vaultPath));
  }
  async importImage(input: ImageInput): Promise<RepositoryResult<ImageAttachment>> {
    const extension = imageExtension(input.bytes);
    if (!extension.ok) return extension;
    const temporaryPath = `.attachments/.anehalo-${crypto.randomUUID()}.tmp`;
    try {
      await this.files.initialize();
      await new VaultFileService(this.files).ensureDirectory('.attachments');
      const vaultRelativePath = `.attachments/${crypto.randomUUID()}.${extension.value}`;
      await this.files.writeBytes(temporaryPath, input.bytes);
      await this.files.rename(temporaryPath, vaultRelativePath);
      return success({ vaultRelativePath, alt: input.name.replace(/\.[^.]+$/, '') });
    } catch (error) {
      const original = describeStorageError(error, 'Could not save the image.');
      try {
        if (await this.files.metadata(temporaryPath))
          await this.files.removeTemporaryFile(temporaryPath);
      } catch (cleanupError) {
        return failure({
          ...original,
          message: `${original.message} ${describeStorageError(cleanupError, 'Could not remove the temporary image.').message}`,
        });
      }
      return failure(original);
    }
  }
  async sourceUrl(notePath: string, reference: string): Promise<RepositoryResult<string>> {
    const path = resolveAttachmentReference(notePath, reference);
    if (!path)
      return failure({
        code: 'invalid-path',
        message: 'This image reference does not point to a vault attachment.',
      });
    try {
      await this.files.initialize();
      if ((await this.files.metadata(path))?.type !== 'file')
        storageFailure('not-found', 'This image attachment is missing from the vault.');
      this.scopePreparation ??= invoke<void>('prepare_attachment_scope', {
        vaultPath: this.vaultPath,
      });
      await this.scopePreparation;
      return success(convertFileSrc(`${this.vaultPath.replace(/[\\/]$/, '')}/${path}`));
    } catch (error) {
      this.scopePreparation = null;
      return failure(describeStorageError(error, 'Could not load this image.'));
    }
  }
}
