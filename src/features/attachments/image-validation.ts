import { failure, success, type RepositoryResult } from '@/features/storage/repository-result';
export const maximumImageBytes = 10 * 1024 * 1024;
export const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
export function imageExtension(bytes: Uint8Array): RepositoryResult<string> {
  if (bytes.byteLength > maximumImageBytes)
    return failure({
      code: 'invalid-type',
      message: 'This image is larger than 10 MB. Choose a smaller image.',
    });
  const startsWith = (signature: readonly number[]) =>
    signature.every((value, index) => bytes[index] === value);
  if (startsWith([137, 80, 78, 71, 13, 10, 26, 10])) return success('png');
  if (startsWith([255, 216, 255])) return success('jpg');
  const header = new TextDecoder().decode(bytes.slice(0, 12));
  if (/^GIF8[79]a/.test(header)) return success('gif');
  if (header.startsWith('RIFF') && header.slice(8) === 'WEBP') return success('webp');
  return failure({
    code: 'invalid-type',
    message: 'Unsupported image. Choose a PNG, JPEG, GIF, or WebP file.',
  });
}
