import type { ReactNode } from 'react';
import { mergeClassNames } from '@/lib/utils';

const iconPaths = {
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20a8 8 0 0 1 16 0" />
    </>
  ),
  spark: <path d="M12 3l2.2 5.6L20 11l-5.8 2.4L12 19l-2.2-5.6L4 11l5.8-2.4z" />,
  bolt: <path d="M13 2L4 14h7l-1 8 9-12h-7z" />,
  export: <path d="M12 4v10M8 10l4 4 4-4M5 20h14" />,
  left: <path d="M19 12H5M11 6l-6 6 6 6" />,
  right: <path d="M5 12h14M13 6l6 6-6 6" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  'all-notes': (
    <>
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="M8 9h8m-8 4h5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  more: (
    <>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </>
  ),
  trash: (
    <>
      <path d="M3 6h18M9 6V4h6v2M6 6l1 14h10l1-14M10 10v6m4-6v6" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" />,
  link: (
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  pen: <path d="m4 20 1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19z" />,
  minimize: <path d="M5 12h14" />,
  maximize: <rect x="6" y="6" width="12" height="12" rx="2" />,
  restore: (
    <>
      <path d="M9 6V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-1" />
      <rect x="4" y="9" width="11" height="11" rx="1" />
    </>
  ),
  close: <path d="m6 6 12 12M18 6 6 18" />,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof iconPaths;

interface IconProps {
  name: IconName;
  className?: string;
}

export function Icon({ name, className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      className={mergeClassNames('icon', className)}
    >
      {iconPaths[name]}
    </svg>
  );
}
