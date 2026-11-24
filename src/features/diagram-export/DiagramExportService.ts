import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { logFailure } from '@/features/diagnostics/error-logging';
import type { DiagramScene } from '@/features/diagrams/diagram-codec';
import { exportFileName, exportFolder } from '@/features/export/export-file-names';
import type { ExportSettings } from '@/features/export/ExportService';
import type {
  ExportExtension,
  ExportOutcome,
  ExportPlatform,
} from '@/features/export/export-types';
import { failure, success, type RepositoryResult } from '@/features/storage/repository-result';
import type { DiagramImageRenderer } from '@/features/thumbnails/thumbnail-renderer';
import { DiagramExportError, exportFailureOf } from './diagram-export-errors';
import { selectionElements, type DiagramExportOptions } from './diagram-export-options';

export type DiagramExportAction = 'save-image' | 'copy-png' | 'copy-svg' | 'save-copy';

export interface DiagramExportRequest {
  readonly action: DiagramExportAction;
  readonly options: DiagramExportOptions;
  /** The selected element ids when only the selection is exported; null for the whole drawing. */
  readonly selection: readonly string[] | null;
}

/** The open diagram as it is right now, including edits that are not saved yet. */
export interface DiagramExportSource {
  readonly title: string;
  readonly scene: DiagramScene;
}

export interface DiagramExportDependencies {
  readonly platform: ExportPlatform;
  /** Loads Excalidraw's drawing functions; called only when something is exported. */
  readonly renderer: () => Promise<DiagramImageRenderer>;
  readonly serializeScene: (scene: DiagramScene) => Promise<string>;
  readonly settings: ExportSettings;
}

const clipboardOptions = (options: DiagramExportOptions): DiagramExportOptions => ({
  ...options,
  // An image on the clipboard cannot carry a scene, so none is computed.
  embedScene: false,
});

/** Turns a drawing and the chosen options into a file, a clipboard image or an Excalidraw copy. */
export class DiagramExportService {
  constructor(private readonly dependencies: DiagramExportDependencies) {}

  async execute(
    source: DiagramExportSource,
    request: DiagramExportRequest,
    progress: (message: string) => void = () => {},
  ): Promise<RepositoryResult<ExportOutcome>> {
    let result: RepositoryResult<ExportOutcome>;
    try {
      result = await this.run(source, request, progress);
    } catch (error) {
      result = failure(exportFailureOf(error, request.options));
    }
    if (!result.ok) logFailure('diagram-export-failed', result.error.code);
    return result;
  }

  private run(
    source: DiagramExportSource,
    { action, options, selection }: DiagramExportRequest,
    progress: (message: string) => void,
  ): Promise<RepositoryResult<ExportOutcome>> {
    switch (action) {
      case 'save-copy':
        return this.saveCopy(source, progress);
      case 'copy-png':
        return this.copyPng(source, { ...clipboardOptions(options), format: 'png' }, selection);
      case 'copy-svg':
        return this.copySvg(source, { ...clipboardOptions(options), format: 'svg' }, selection);
      case 'save-image':
        return this.saveImage(source, options, selection, progress);
    }
  }

  /** The drawing's visible elements, or only the selected ones. */
  private elementsToExport(
    scene: DiagramScene,
    selection: readonly string[] | null,
  ): readonly ExcalidrawElement[] {
    const visible = scene.elements.filter((element) => !element.isDeleted);
    const elements = selection ? selectionElements(visible, new Set(selection)) : visible;
    if (elements.length === 0)
      throw new DiagramExportError(
        'empty',
        selection
          ? 'Select something to export first.'
          : 'This diagram is empty. Draw something first.',
      );
    return elements;
  }

  private async drawPng(
    source: DiagramExportSource,
    options: DiagramExportOptions,
    selection: readonly string[] | null,
  ): Promise<Uint8Array> {
    const elements = this.elementsToExport(source.scene, selection);
    const renderer = await this.dependencies.renderer();
    const blob = await renderer.png({ scene: source.scene, elements, options });
    return new Uint8Array(await blob.arrayBuffer());
  }

  private async drawSvg(
    source: DiagramExportSource,
    options: DiagramExportOptions,
    selection: readonly string[] | null,
  ): Promise<string> {
    const elements = this.elementsToExport(source.scene, selection);
    const renderer = await this.dependencies.renderer();
    return renderer.svg({ scene: source.scene, elements, options });
  }

  private async copyPng(
    source: DiagramExportSource,
    options: DiagramExportOptions,
    selection: readonly string[] | null,
  ): Promise<RepositoryResult<ExportOutcome>> {
    const png = await this.drawPng(source, options, selection);
    const copied = await this.dependencies.platform.writeClipboardImage(png);
    return copied.ok
      ? success({ status: 'copied', message: 'Copied PNG to the clipboard' })
      : copied;
  }

  private async copySvg(
    source: DiagramExportSource,
    options: DiagramExportOptions,
    selection: readonly string[] | null,
  ): Promise<RepositoryResult<ExportOutcome>> {
    const svg = await this.drawSvg(source, options, selection);
    const copied = await this.dependencies.platform.writeClipboard(svg);
    return copied.ok
      ? success({ status: 'copied', message: 'Copied SVG to the clipboard' })
      : copied;
  }

  private async saveImage(
    source: DiagramExportSource,
    options: DiagramExportOptions,
    selection: readonly string[] | null,
    progress: (message: string) => void,
  ): Promise<RepositoryResult<ExportOutcome>> {
    // Fail before the dialog when there is nothing to draw.
    this.elementsToExport(source.scene, selection);
    return this.saveToDisk(source.title, options.format, async () => {
      progress('Drawing the diagram…');
      if (options.format === 'png') return this.drawPng(source, options, selection);
      return new TextEncoder().encode(await this.drawSvg(source, options, selection));
    });
  }

  private saveCopy(
    source: DiagramExportSource,
    progress: (message: string) => void,
  ): Promise<RepositoryResult<ExportOutcome>> {
    return this.saveToDisk(source.title, 'excalidraw', async () => {
      progress('Preparing the copy…');
      return new TextEncoder().encode(await this.dependencies.serializeScene(source.scene));
    });
  }

  /** Asks where to save, then draws and writes, so cancelling the dialog costs nothing. */
  private async saveToDisk(
    title: string,
    extension: ExportExtension,
    produce: () => Promise<Uint8Array>,
  ): Promise<RepositoryResult<ExportOutcome>> {
    const { platform, settings } = this.dependencies;
    const choice = await platform.chooseDestination(
      exportFileName(title, extension, 'Untitled diagram'),
      extension,
      settings.lastFolder(),
    );
    if (!choice.ok) return choice;
    if (!choice.value) return success({ status: 'cancelled' });
    if (!choice.value.toLowerCase().endsWith(`.${extension}`))
      return failure({
        code: 'invalid-name',
        message: `Choose a file name ending in .${extension}.`,
      });
    const bytes = await produce();
    const written = await platform.writeBundle({ path: choice.value, bytes, assets: [] });
    if (!written.ok) return written;
    const remembered = await settings.rememberFolder(exportFolder(choice.value));
    return success({
      status: 'saved',
      message: savedMessages[extension],
      path: choice.value,
      ...(remembered.ok ? {} : { warning: rememberFailure }),
    });
  }
}

const savedMessages: Readonly<Record<ExportExtension, string>> = {
  png: 'Saved PNG image',
  svg: 'Saved SVG image',
  excalidraw: 'Saved a copy of the diagram',
  md: 'Saved Markdown',
  pdf: 'Saved PDF',
};

const rememberFailure: string =
  'The file was saved, but the last export folder could not be remembered.';
