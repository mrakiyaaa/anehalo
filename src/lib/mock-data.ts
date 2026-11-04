import type { Folder, Note } from '@/types/notes';

export const mockWorkspace = {
  displayName: 'Akila',
  storagePath: 'Documents\\Anehalo',
} as const;

export const mockFolders: readonly Folder[] = [
  { id: 'work', name: 'Work', tone: 'sky' },
  { id: 'study', name: 'Study', tone: 'mint' },
  { id: 'projects', name: 'Projects', tone: 'lilac' },
  { id: 'personal', name: 'Personal', tone: 'peach' },
  { id: 'gym', name: 'Gym', tone: 'rose' },
  { id: 'ideas', name: 'Ideas', tone: 'butter' },
];

export const mockNotes: readonly Note[] = [
  {
    id: 'login-flow',
    title: 'Login flow test cases',
    text: 'Valid, invalid and locked-account paths. Add boundary checks for the password field.',
    folderId: 'work',
    editedLabel: '12 min ago',
    linkedNoteTitle: 'Playwright locators',
  },
  {
    id: 'playwright-locators',
    title: 'Playwright locators',
    text: 'getByRole first, then getByTestId. Avoid XPath unless there is no other way.',
    folderId: 'work',
    editedLabel: 'Yesterday',
  },
  {
    id: 'istqb-revision',
    title: 'ISTQB revision',
    text: 'Equivalence partitioning, boundary values, decision tables. Redo mock paper 2.',
    folderId: 'study',
    editedLabel: 'Yesterday',
  },
  {
    id: 'anehalo-features',
    title: 'Anehalo feature list',
    text: 'Auto-save, /page links, PDF export, dark mode with a smooth switch.',
    folderId: 'projects',
    editedLabel: '2 days ago',
    linkedNoteTitle: 'Anehalo build phases',
  },
  {
    id: 'anehalo-phases',
    title: 'Anehalo build phases',
    text: 'Setup, UI shell, storage, editor, linking, export, polish.',
    folderId: 'projects',
    editedLabel: '2 days ago',
  },
  {
    id: 'weekend-plan',
    title: 'Weekend plan',
    text: 'Laundry, call home, buy a new notebook.',
    folderId: 'personal',
    editedLabel: 'Monday',
  },
  {
    id: 'push-day',
    title: 'Push day',
    text: 'Bench 4x8, incline press 3x10, lateral raises 3x15.',
    folderId: 'gym',
    editedLabel: 'Sunday',
  },
  {
    id: 'app-names',
    title: 'App name ideas',
    text: 'Short, soft, easy to type.',
    folderId: 'ideas',
    editedLabel: '31 Oct',
  },
];
