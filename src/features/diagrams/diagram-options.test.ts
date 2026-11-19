import { describe, expect, it, vi } from 'vitest';
import { diagramOptions, preventLinkNavigation } from './diagram-options';

describe('diagram options', () => {
  it('turns off every feature that needs a network service', () => {
    expect(diagramOptions.aiEnabled).toBe(false);
    expect(diagramOptions.langCode).toBe('en');
    for (const link of [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://excalidraw.com',
      'http://localhost:1420',
    ])
      expect(diagramOptions.validateEmbeddable(link)).toBe(false);
  });

  it('hides file actions until diagrams can be saved, and leaves the theme to Anehalo', () => {
    expect(diagramOptions.UIOptions.canvasActions).toEqual({
      changeViewBackgroundColor: true,
      clearCanvas: true,
      export: false,
      loadScene: false,
      saveAsImage: false,
      saveToActiveFile: false,
      toggleTheme: false,
    });
  });

  it('stops element links from navigating the app window', () => {
    const event = new CustomEvent('link-open', { cancelable: true });
    const preventDefault = vi.spyOn(event, 'preventDefault');

    preventLinkNavigation(
      {} as Parameters<typeof preventLinkNavigation>[0],
      event as Parameters<typeof preventLinkNavigation>[1],
    );

    expect(preventDefault).toHaveBeenCalledOnce();
  });
});
