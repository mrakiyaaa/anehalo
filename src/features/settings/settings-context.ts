import { createContext } from 'react';
import type { SettingsStore } from '@/features/settings/settings-store';

export const SettingsContext = createContext<SettingsStore | null>(null);
