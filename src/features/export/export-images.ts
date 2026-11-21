import type { JSONContent } from '@tiptap/core';
import { logFailure } from '@/features/diagnostics/error-logging';
import { encodeNotePath } from '@/features/note-links/note-link-paths';
import { success, type RepositoryResult } from '@/features/storage/repository-result';
import type { ExportAsset, ExportDocument, ExportImage, ExportPlatform } from './export-types';
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

export interface EmbeddedDiagram {
  readonly path: string;
  readonly title: string;
  /** How the note's Markdown and HTML spell the path, which export replacements match. */
  readonly reference: string;
}

/** The diagrams embedded in a note, once each. */
export function embeddedDiagrams(document: JSONContent): readonly EmbeddedDiagram[] {
  const diagrams = new Map<string, EmbeddedDiagram>();
  function visit(node: JSONContent) {
    const path: unknown = node.attrs?.path;
    if (node.type === 'diagramEmbed' && typeof path === 'string' && !diagrams.has(path))
      diagrams.set(path, {
        path,
        title: String(node.attrs?.title ?? ''),
        reference: encodeNotePath(path),
      });
    node.content?.forEach(visit);
  }
  visit(document);
  return [...diagrams.values()];
}

export function imageDataUrl(bytes: Uint8Array, mimeType: string): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return `data:${mimeType};base64,${btoa(binary)}`;
}

export interface PreparedImages {
  /** Source reference (image src, or a diagram's encoded path) to what the export uses. */
  readonly references: ReadonlyMap<string, string>;
  readonly assets: readonly ExportAsset[];
  /** Embedded diagrams that could not be drawn; the export shows a placeholder for each. */
  readonly unavailableDiagrams: readonly EmbeddedDiagram[];
}

/**
 * Loads a note's images, and draws its embedded diagrams when `drawDiagram` is given (every
 * export except Copy as Markdown, which keeps the embed syntax). An image that cannot be read
 * fails the export as before; a diagram that cannot be drawn does not: it is logged and left
 * out, so the rest of the note still exports.
 */
export async function prepareExportImages(
  source: ExportDocument,
  platform: ExportPlatform,
  destination?: string,
  drawDiagram?: (path: string) => Promise<RepositoryResult<ExportImage>>,
): Promise<RepositoryResult<PreparedImages>> {
  const references = new Map<string, string>();
  const assets: ExportAsset[] = [];
  const unavailableDiagrams: EmbeddedDiagram[] = [];
  const occupied = new Set<string>();
  function include(reference: string, image: ExportImage) {
    if (!destination) {
      references.set(reference, imageDataUrl(image.bytes, image.mimeType));
      return;
    }
    const extension = image.name.split('.').at(-1) ?? 'png';
    let name = image.name;
    for (let sequence = 2; occupied.has(name.toLowerCase()); sequence += 1)
      name = `${image.name.slice(0, -(extension.length + 1))} ${sequence}.${extension}`;
    occupied.add(name.toLowerCase());
    assets.push({ name, bytes: image.bytes });
    references.set(reference, encodeExportReference(`${assetsFolderName(destination)}/${name}`));
  }
  for (const reference of imageReferences(source.document)) {
    const result = await platform.loadImage(source.relativePath, reference);
    if (!result.ok) return result;
    include(reference, result.value);
  }
  if (drawDiagram)
    for (const diagram of embeddedDiagrams(source.document)) {
      const drawn = await drawDiagram(diagram.path);
      if (drawn.ok) include(diagram.reference, drawn.value);
      else {
        logFailure('diagram-export-failed', drawn.error.code);
        unavailableDiagrams.push(diagram);
      }
    }
  return success({ references, assets, unavailableDiagrams });
}

/** The text that stands in for a diagram that could not be drawn. */
export function unavailableDiagramText(diagram: EmbeddedDiagram): string {
  return `Diagram unavailable: ${diagram.title || diagram.path}`;
}

/** The warning shown after an export that left diagrams out. */
export function skippedDiagramsWarning(diagrams: readonly EmbeddedDiagram[]): string | null {
  if (diagrams.length === 0) return null;
  const titles = diagrams.map((diagram) => diagram.title || diagram.path).join(', ');
  return `Exported without ${diagrams.length === 1 ? 'a diagram that' : `${diagrams.length} diagrams that`} could not be drawn: ${titles}.`;
}
