import type { JSONContent } from '@tiptap/core';
import { success, type RepositoryResult } from '@/features/storage/repository-result';
import type { ExportAsset, ExportDocument, ExportPlatform } from './export-types';
import { assetsFolderName, encodeExportReference } from './export-file-names';

export function imageReferences(document: JSONContent): readonly string[] {
  const references = new Set<string>();
  function visit(node: JSONContent) {
    if (node.type === 'image' && typeof node.attrs?.src === 'string')
      references.add(node.attrs.src);
    node.content?.forEach(visit);
  }
  visit(document);
  return [...references];
}
export function imageDataUrl(bytes: Uint8Array, mimeType: string): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return `data:${mimeType};base64,${btoa(binary)}`;
}
export async function prepareExportImages(
  source: ExportDocument,
  platform: ExportPlatform,
  destination?: string,
): Promise<
  RepositoryResult<{ references: ReadonlyMap<string, string>; assets: readonly ExportAsset[] }>
> {
  const references = new Map<string, string>();
  const assets: ExportAsset[] = [];
  const occupied = new Set<string>();
  for (const reference of imageReferences(source.document)) {
    const result = await platform.loadImage(source.relativePath, reference);
    if (!result.ok) return result;
    const image = result.value;
    if (!destination) references.set(reference, imageDataUrl(image.bytes, image.mimeType));
    else {
      const extension = image.name.split('.').at(-1) ?? 'png';
      let name = image.name;
      for (let sequence = 2; occupied.has(name.toLowerCase()); sequence += 1)
        name = `${image.name.slice(0, -(extension.length + 1))} ${sequence}.${extension}`;
      occupied.add(name.toLowerCase());
      assets.push({ name, bytes: image.bytes });
      references.set(reference, encodeExportReference(`${assetsFolderName(destination)}/${name}`));
    }
  }
  return success({ references, assets });
}
