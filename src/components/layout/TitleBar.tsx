import { APP_NAME } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/Icon';
import { useWindowControls } from '@/components/layout/use-window-controls';
import { ThemeSwitch } from '@/features/theme/ThemeSwitch';
import { Logo } from '@/components/ui/Logo';

export function TitleBar() {
  const { isNativeWindow, isMaximized, windowError, runWindowAction } = useWindowControls();

  return (
    <header className="app-titlebar" data-tauri-drag-region>
      <div className="app-brand" data-tauri-drag-region>
        <span className="app-logo" data-tauri-drag-region>
          <Logo variant="mark" />
        </span>
        <span data-tauri-drag-region>{APP_NAME}</span>
      </div>
      <div className="titlebar-controls">
        <ThemeSwitch />
        <Button
          variant="ghost"
          className="window-button"
          aria-label="Minimize"
          disabled={!isNativeWindow}
          onClick={() => {
            void runWindowAction('minimize');
          }}
        >
          <Icon name="minimize" />
        </Button>
        <Button
          variant="ghost"
          className="window-button"
          aria-label={isMaximized ? 'Restore' : 'Maximize'}
          disabled={!isNativeWindow}
          onClick={() => {
            void runWindowAction('toggleMaximize');
          }}
        >
          <Icon name={isMaximized ? 'restore' : 'maximize'} />
        </Button>
        <Button
          variant="ghost"
          className="window-button close-window-button"
          aria-label="Close"
          disabled={!isNativeWindow}
          onClick={() => {
            void runWindowAction('close');
          }}
        >
          <Icon name="close" />
        </Button>
      </div>
      {windowError && (
        <p role="alert" className="titlebar-notice">
          {windowError}
        </p>
      )}
    </header>
  );
}
