import type { RepositoryResult } from '@/features/storage/repository-result';

export interface ImageInput {
  readonly name: string;
  readonly bytes: Uint8Array;
}
export interface ImageAttachment {
  readonly vaultRelativePath: string;
  readonly alt: string;
}
export interface AttachmentRepository {
  importImage(input: ImageInput): Promise<RepositoryResult<ImageAttachment>>;
  sourceUrl(notePath: string, reference: string): Promise<RepositoryResult<string>>;
}
