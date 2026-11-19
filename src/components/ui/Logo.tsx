import logoNoteLight from '@/assets/logo-note-light.png';
import logoNoteDark from '@/assets/logo-note-dark.png';
import logoFull from '@/assets/logo-full.png';
import { mergeClassNames } from '@/lib/utils';
import { useThemeStore } from '@/store/theme-store';
import type { Theme } from '@/types/theme';

type LogoVariant = 'note' | 'full';

interface LogoProps {
  variant: LogoVariant;
  className?: string;
}

interface LogoImage {
  source: string;
  description: string;
  width: number;
  height: number;
}

const noteLogoSources: Record<Theme, string> = {
  light: logoNoteLight,
  dark: logoNoteDark,
};

function resolveLogoImage(variant: LogoVariant, theme: Theme): LogoImage {
  if (variant === 'note')
    return {
      source: noteLogoSources[theme],
      description: 'Anehalo note icon',
      width: 22,
      height: 22,
    };
  return {
    source: logoFull,
    description: 'Anehalo mascot and wordmark',
    width: 1536,
    height: 1024,
  };
}

export function Logo({ variant, className }: LogoProps) {
  const theme = useThemeStore((state) => state.theme);
  const logo = resolveLogoImage(variant, theme);
  return (
    <img
      className={mergeClassNames('logo', `logo-${variant}`, className)}
      src={logo.source}
      alt={logo.description}
      width={logo.width}
      height={logo.height}
      decoding="async"
      draggable={false}
    />
  );
}
