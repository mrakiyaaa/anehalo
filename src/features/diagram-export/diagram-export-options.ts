export type DiagramImageFormat = 'png' | 'svg';
export type DiagramExportTheme = 'light' | 'dark';
export type DiagramExportScale = 1 | 2 | 3;

/** What the Export popover remembers between exports (settings.json). */
export interface DiagramExportOptions {
  readonly format: DiagramImageFormat;
  readonly background: boolean;
  readonly theme: DiagramExportTheme;
  /** Only PNG has a pixel size; SVG scales freely. */
  readonly scale: DiagramExportScale;
  /** Puts the drawing inside the image, so it can be imported again. */
  readonly embedScene: boolean;
}

export const diagramExportScales: readonly DiagramExportScale[] = [1, 2, 3];

export const defaultDiagramExportOptions: DiagramExportOptions = {
  format: 'png',
  background: true,
  theme: 'light',
  scale: 2,
  embedScene: false,
};

function isScale(value: unknown): value is DiagramExportScale {
  return diagramExportScales.some((scale) => scale === value);
}

/** Settings from before diagram export, or edited by hand, fall back field by field. */
export function parseDiagramExportOptions(value: unknown): DiagramExportOptions {
  const defaults = defaultDiagramExportOptions;
  if (typeof value !== 'object' || value === null) return defaults;
  const format = 'format' in value ? value.format : undefined;
  const theme = 'theme' in value ? value.theme : undefined;
  const scale = 'scale' in value ? value.scale : undefined;
  const background = 'background' in value ? value.background : undefined;
  const embedScene = 'embedScene' in value ? value.embedScene : undefined;
  return {
    format: format === 'png' || format === 'svg' ? format : defaults.format,
    theme: theme === 'light' || theme === 'dark' ? theme : defaults.theme,
    scale: isScale(scale) ? scale : defaults.scale,
    background: typeof background === 'boolean' ? background : defaults.background,
    embedScene: typeof embedScene === 'boolean' ? embedScene : defaults.embedScene,
  };
}

/** The Excalidraw export fields that the options decide. */
export interface ExcalidrawExportAppState {
  readonly exportBackground: boolean;
  readonly exportWithDarkMode: boolean;
  readonly exportEmbedScene: boolean;
  readonly exportScale: DiagramExportScale;
}

export function excalidrawExportAppState(options: DiagramExportOptions): ExcalidrawExportAppState {
  return {
    exportBackground: options.background,
    exportWithDarkMode: options.theme === 'dark',
    exportEmbedScene: options.embedScene,
    exportScale: options.format === 'png' ? options.scale : 1,
  };
}

export const imageMimeTypes: Readonly<Record<DiagramImageFormat, string>> = {
  png: 'image/png',
  svg: 'image/svg+xml',
};

/**
 * Chromium refuses canvases with a side past this size (and fails to encode them without saying
 * why), so a too-large PNG is reported before drawing. Its area limit is the square of this.
 */
export const maximumCanvasSide = 16_384;

export function exceedsCanvasLimits(width: number, height: number): boolean {
  return width > maximumCanvasSide || height > maximumCanvasSide;
}

interface SelectableElement {
  readonly id: string;
  readonly type: string;
  readonly containerId?: string | null;
  readonly frameId?: string | null;
}

/**
 * The elements a "selection only" export draws: the selected ones, the text bound to selected
 * shapes, and everything inside selected frames, as Excalidraw's own export does.
 */
export function selectionElements<Element extends SelectableElement>(
  elements: readonly Element[],
  selectedIds: ReadonlySet<string>,
): Element[] {
  const frames = new Set(
    elements
      .filter((element) => selectedIds.has(element.id) && /frame$/i.test(element.type))
      .map((element) => element.id),
  );
  return elements.filter(
    (element) =>
      selectedIds.has(element.id) ||
      (element.containerId != null && selectedIds.has(element.containerId)) ||
      (element.frameId != null && frames.has(element.frameId)),
  );
}
