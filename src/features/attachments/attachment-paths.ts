import { validateRelativePath } from '@/features/storage/storage-paths';
const attachmentPattern = /^\.attachments\/[\w.-]+\.(png|jpe?g|gif|webp)$/i;
export function attachmentReference(notePath: string, vaultRelativePath: string): string {
  validateRelativePath(notePath);
  if (!attachmentPattern.test(vaultRelativePath)) throw new Error('Invalid attachment path.');
  return '../'.repeat(notePath.split('/').length - 1) + vaultRelativePath;
}
export function resolveAttachmentReference(notePath: string, reference: string): string | null {
  const components = notePath.split('/').slice(0, -1);
  for (const component of reference.split('/')) {
    if (component === '..') {
      if (components.length === 0) return null;
      components.pop();
    } else if (component === '.') continue;
    else components.push(component);
  }
  const path = components.join('/');
  return attachmentPattern.test(path) ? path : null;
}
