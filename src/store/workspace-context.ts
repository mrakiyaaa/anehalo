import { createContext } from 'react';
import type { WorkspaceStore } from '@/store/workspace-store';

export const WorkspaceContext = createContext<WorkspaceStore | null>(null);
