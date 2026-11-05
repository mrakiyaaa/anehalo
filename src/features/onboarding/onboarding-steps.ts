import type { IconName } from '@/components/ui/Icon';
import type { PastelTone } from '@/types/notes';

export interface OnboardingScene {
  readonly tone: PastelTone;
  readonly hero: IconName;
  readonly floaters: readonly (readonly [IconName, string])[];
}

export const onboardingSteps = [
  {
    id: 'welcome',
    tone: 'sky',
    hero: 'pen',
    floaters: [
      ['check', 'Saved just now'],
      ['link', '/page'],
      ['folder', 'Ideas'],
    ],
    title: 'Meet Anehalo',
    lead: 'Instant notes that save themselves. Open the app, start typing, and you are done.',
  },
  {
    id: 'name',
    tone: 'peach',
    hero: 'user',
    floaters: [
      ['spark', 'Hello there'],
      ['pen', 'Your notes'],
      ['check', 'Stays on this PC'],
    ],
    title: 'What should we call you?',
    lead: 'We use your name for a friendly hello on the home screen. It never leaves this PC.',
  },
  {
    id: 'folder',
    tone: 'mint',
    hero: 'folder',
    floaters: [
      ['folder', 'Work'],
      ['folder', 'Study'],
      ['folder', 'Projects'],
    ],
    title: 'Where should notes live?',
    lead: 'Every folder is a real folder and every note is a .md file. Back them up or open them anywhere.',
  },
  {
    id: 'theme',
    tone: 'lilac',
    hero: 'sun',
    floaters: [
      ['sun', 'Light'],
      ['moon', 'Dark'],
      ['spark', 'Smooth switch'],
    ],
    title: 'Pick your look',
    lead: 'Switch any time with the sun and moon at the top of the window.',
  },
  {
    id: 'tips',
    tone: 'butter',
    hero: 'spark',
    floaters: [
      ['check', 'Auto-save'],
      ['link', '/page'],
      ['export', 'Export'],
    ],
    title: 'Four quick tips',
    lead: 'That is all the setup. Here is what keeps Anehalo fast.',
  },
] as const satisfies readonly (OnboardingScene & { id: string; title: string; lead: string })[];

export const summaryScene: OnboardingScene = {
  tone: 'mint',
  hero: 'check',
  floaters: [
    ['folder', 'Notes ready'],
    ['check', 'All set'],
    ['pen', 'Start typing'],
  ],
};
