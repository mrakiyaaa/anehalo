import './excalidraw-asset-path';
import '@excalidraw/excalidraw/index.css';
import './excalidraw-overrides.css';
import { Excalidraw, MainMenu, WelcomeScreen } from '@excalidraw/excalidraw';
import { Moon, Sun } from 'lucide-react';
import { useAnimatedThemeToggle } from '@/features/theme/use-animated-theme-toggle';
import { useThemeStore } from '@/store/theme-store';
import { diagramOptions, preventLinkNavigation } from './diagram-options';

/** The only module that imports Excalidraw, so it stays in a chunk loaded on demand. */
export function DiagramCanvas() {
  const theme = useThemeStore((state) => state.theme);
  const { toggleFrom } = useAnimatedThemeToggle();
  const isDark = theme === 'dark';

  return (
    <div className="diagram-canvas">
      <Excalidraw theme={theme} onLinkOpen={preventLinkNavigation} {...diagramOptions}>
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
