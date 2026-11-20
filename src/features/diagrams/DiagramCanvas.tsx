import './excalidraw-environment';
import '@excalidraw/excalidraw/index.css';
import './excalidraw-overrides.css';
import { Excalidraw, MainMenu, WelcomeScreen, hashElementsVersion } from '@excalidraw/excalidraw';
import { Moon, Sun } from 'lucide-react';
import { useRef } from 'react';
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
}

/** The only module that imports Excalidraw, so it stays in a chunk loaded on demand. */
export function DiagramCanvas({ scene, onDocumentChange, onElementLink }: DiagramCanvasProps) {
  const theme = useThemeStore((state) => state.theme);
  const savedFingerprint = useRef(diagramFingerprint(scene, hashElementsVersion));
  const { toggleFrom } = useAnimatedThemeToggle();
  const isDark = theme === 'dark';

  return (
    <div className="diagram-canvas">
      <Excalidraw
        theme={theme}
        initialData={{ elements: scene.elements, appState: scene.appState, files: scene.files }}
        onChange={(elements, appState, files) => {
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
}
