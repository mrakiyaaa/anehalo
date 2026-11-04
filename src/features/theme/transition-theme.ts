interface TransitionOrigin {
  horizontal: number;
  vertical: number;
}

async function fadeTheme(updateTheme: () => void, reducedMotion: boolean) {
  const root = document.documentElement;
  root.classList.add('theme-fade');
  root.style.setProperty('--theme-fade-duration', reducedMotion ? '180ms' : '400ms');
  root.getBoundingClientRect();
  try {
    updateTheme();
    await new Promise<void>((resolve) => window.setTimeout(resolve, reducedMotion ? 200 : 450));
  } finally {
    root.classList.remove('theme-fade');
    root.style.removeProperty('--theme-fade-duration');
  }
}

export async function transitionTheme(origin: TransitionOrigin, updateTheme: () => void) {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (typeof document.startViewTransition !== 'function' || reducedMotion) {
    await fadeTheme(updateTheme, reducedMotion);
    return;
  }

  let themeApplied = false;
  const applyThemeOnce = () => {
    if (themeApplied) return;
    updateTheme();
    themeApplied = true;
  };
  let transition: ViewTransition;
  try {
    transition = document.startViewTransition(applyThemeOnce);
  } catch {
    await fadeTheme(applyThemeOnce, reducedMotion);
    return;
  }

  try {
    await transition.ready;
    const radius = Math.hypot(
      Math.max(origin.horizontal, window.innerWidth - origin.horizontal),
      Math.max(origin.vertical, window.innerHeight - origin.vertical),
    );
    const center = `${origin.horizontal}px ${origin.vertical}px`;
    const animation = document.documentElement.animate(
      { clipPath: [`circle(0px at ${center})`, `circle(${radius}px at ${center})`] },
      {
        duration: 650,
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
        pseudoElement: '::view-transition-new(root)',
      },
    );
    await animation.finished;
    await transition.finished;
  } catch {
    // A minimized or hidden window can cancel a transition after the theme changed.
    transition.skipTransition();
    await transition.updateCallbackDone.catch(() => undefined);
    await fadeTheme(applyThemeOnce, reducedMotion);
  }
}
