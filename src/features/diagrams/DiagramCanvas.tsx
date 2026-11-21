import './excalidraw-environment';
import '@excalidraw/excalidraw/index.css';
import './excalidraw-overrides.css';
import { Excalidraw, MainMenu, WelcomeScreen, hashElementsVersion } from '@excalidraw/excalidraw';
import { Moon, Sun } from 'lucide-react';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { useAnimatedThemeToggle } from '@/features/theme/use-animated-theme-toggle';
import { useThemeStore } from '@/store/theme-store';
import { diagramOptions, elementLinkHandler } from './diagram-options';
import type { DiagramScene } from './diagram-codec';
import { diagramFingerprint } from './diagram-fingerprint';

interface DiagramCanvasProps {
  /** The drawing to show. The canvas reads it once; give it a new key to load another. */
  readonly scene: DiagramScene;
  /** Called only when the document changed, never for zoom, scroll, selection or tool. */
  readonly onDocumentChange: (scene: DiagramScene) => void;
  /** Called with an element's link when it is clicked; the canvas itself never follows it. */
  readonly onElementLink: (link: string) => void;
  /** Called once the drawing is on the canvas, so elements can be focused. */
  readonly onSceneReady?: () => void;
}

export interface DiagramCanvasHandle {
  /** Brings an element into view and selects it briefly; false when it is not in the scene. */
  focusElement(elementId: string): boolean;
}

/** Long enough to see which shape was found, short enough not to get in the way of editing. */
const FOCUS_SELECTION_MS = 2_000;

/** The only module that imports Excalidraw, so it stays in a chunk loaded on demand. */
export const DiagramCanvas = forwardRef<DiagramCanvasHandle, DiagramCanvasProps>(
  function DiagramCanvas({ scene, onDocumentChange, onElementLink, onSceneReady }, ref) {
    const theme = useThemeStore((state) => state.theme);
    const savedFingerprint = useRef(diagramFingerprint(scene, hashElementsVersion));
    const { toggleFrom } = useAnimatedThemeToggle();
    const isDark = theme === 'dark';
    const api = useRef<ExcalidrawImperativeAPI | null>(null);
    const wrapper = useRef<HTMLDivElement>(null);
    const isReady = useRef(false);
    const deselectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(
      () => () => {
        if (deselectTimer.current) clearTimeout(deselectTimer.current);
      },
      [],
    );

    useImperativeHandle(
      ref,
      () => ({
        focusElement(elementId) {
          const canvas = api.current;
          const element = canvas
            ?.getSceneElements()
            .find((candidate) => candidate.id === elementId && !candidate.isDeleted);
          if (!canvas || !element) return false;
          canvas.updateScene({ appState: { selectedElementIds: { [elementId]: true } } });
          canvas.scrollToContent(element, {
            fitToViewport: true,
            viewportZoomFactor: 0.5,
            animate: true,
          });
          if (wrapper.current) wrapper.current.dataset.focusedElement = elementId;
          if (deselectTimer.current) clearTimeout(deselectTimer.current);
          deselectTimer.current = setTimeout(() => {
            deselectTimer.current = null;
            const selected = Object.keys(canvas.getAppState().selectedElementIds);
            // Only the highlight is undone; a selection the user made since then is kept.
            if (selected.length === 1 && selected[0] === elementId)
              canvas.updateScene({ appState: { selectedElementIds: {} } });
          }, FOCUS_SELECTION_MS);
          return true;
        },
      }),
      [],
    );

    return (
      <div className="diagram-canvas" ref={wrapper}>
        <Excalidraw
          theme={theme}
          excalidrawAPI={(instance) => {
            api.current = instance;
          }}
          initialData={{ elements: scene.elements, appState: scene.appState, files: scene.files }}
          onChange={(elements, appState, files) => {
            if (!isReady.current && (elements.length > 0 || scene.elements.length === 0)) {
              isReady.current = true;
              onSceneReady?.();
            }
            const next: DiagramScene = { elements, appState, files };
            const fingerprint = diagramFingerprint(next, hashElementsVersion);
            if (fingerprint === savedFingerprint.current) return;
            savedFingerprint.current = fingerprint;
            onDocumentChange(next);
          }}
          onLinkOpen={elementLinkHandler(onElementLink)}
          // A new or opened diagram is ready to draw on, with Excalidraw's selection tool active.
          autoFocus
          {...diagramOptions}
        >
          <MainMenu>
            <MainMenu.Item
              icon={isDark ? <Sun size={16} /> : <Moon size={16} />}
              onSelect={(event) => {
                void toggleFrom(
                  event.target instanceof Element ? event.target : document.documentElement,
                );
              }}
            >
              {isDark ? 'Light mode' : 'Dark mode'}
            </MainMenu.Item>
            <MainMenu.DefaultItems.ClearCanvas />
            <MainMenu.DefaultItems.Help />
          </MainMenu>
          <WelcomeScreen>
            <WelcomeScreen.Hints.MenuHint />
            <WelcomeScreen.Hints.ToolbarHint />
            <WelcomeScreen.Hints.HelpHint />
          </WelcomeScreen>
        </Excalidraw>
      </div>
    );
  },
);
