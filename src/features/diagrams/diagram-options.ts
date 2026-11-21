import type { ExcalidrawProps } from '@excalidraw/excalidraw/types';

/** Embedded websites would load over the network, so no link may become an embed. */
const refuseEveryEmbed: (link: string) => boolean = () => false;

/**
 * Excalidraw settings for a fully offline app: no AI, no embedded websites, and no file actions
 * until diagrams can be saved (later phases). The theme comes from Anehalo, so Excalidraw's own
 * theme toggle is off.
 */
export const diagramOptions = {
  langCode: 'en',
  aiEnabled: false,
  validateEmbeddable: refuseEveryEmbed,
  UIOptions: {
    canvasActions: {
      changeViewBackgroundColor: true,
      clearCanvas: true,
      export: false,
      loadScene: false,
      saveAsImage: false,
      saveToActiveFile: false,
      toggleTheme: false,
    },
    tools: { image: true },
  },
} satisfies Partial<ExcalidrawProps>;

/**
 * Element links must never navigate the app's window: Excalidraw's own handling is always
 * cancelled, and the link is handed to Anehalo, which opens vault items itself and web pages
 * only in the default browser.
 */
export function elementLinkHandler(
  open: (link: string) => void,
): NonNullable<ExcalidrawProps['onLinkOpen']> {
  return (element, event) => {
    event.preventDefault();
    if (element.link) open(element.link);
  };
}

export const preventLinkNavigation = elementLinkHandler(() => undefined);
