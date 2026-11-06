import logoMark from '@/assets/logo-mark.png';
import logoFull from '@/assets/logo-full.png';
import { mergeClassNames } from '@/lib/utils';

interface LogoProps {
  variant: 'mark' | 'full';
  className?: string;
}

const logoVariants = {
  mark: { source: logoMark, description: 'Anehalo note icon', width: 22, height: 22 },
  full: { source: logoFull, description: 'Anehalo mascot and wordmark', width: 1536, height: 1024 },
};

export function Logo({ variant, className }: LogoProps) {
  const logo = logoVariants[variant];
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
