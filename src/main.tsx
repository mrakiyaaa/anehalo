import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/app/App';
import { AppProviders } from '@/app/providers/AppProviders';
import '@/styles/globals.css';
import { TauriNoteRepository } from '@/features/storage/TauriNoteRepository';

const noteRepository = new TauriNoteRepository();

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Unable to start Anehalo: the root element is missing.');
}

createRoot(rootElement).render(
  <StrictMode>
    <AppProviders repository={noteRepository}>
      <App />
    </AppProviders>
  </StrictMode>,
);
