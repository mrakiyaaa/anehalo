import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { SaveStatusIndicator } from '@/components/ui/SaveStatusIndicator';
import { createWorkspaceStore } from '@/store/workspace-store';
import { WorkspaceContext } from '@/store/workspace-context';
import { diagramSummary } from '@/features/storage/vault-items';
import { InMemoryNoteRepository } from '@/features/storage/InMemoryNoteRepository';
import { success } from '@/features/storage/repository-result';
import { sceneWith } from '@/test/diagram-helpers';
import type { DiagramDraft } from './DiagramAutoSaver';
import { DiagramNotice } from './DiagramNotice';

const draft: DiagramDraft = {
  summary: diagramSummary('Flow.excalidraw', 1),
  scene: sceneWith('start'),
  dirty: true,
  status: 'retrying',
  error: { code: 'conflict', message: 'This diagram changed outside Anehalo.' },
  hasExternalChange: true,
  isMissing: false,
  documentVersion: 0,
};

function renderNotice(diagram: DiagramDraft) {
  const store = createWorkspaceStore(new InMemoryNoteRepository());
  const choices: string[] = [];
  store.setState({
    resolveDiagramConflict: (choice) => {
      choices.push(choice);
      return Promise.resolve(success(undefined));
    },
  });
  render(
    <WorkspaceContext.Provider value={store}>
      <DiagramNotice diagram={diagram} />
    </WorkspaceContext.Provider>,
  );
  return choices;
}

describe('diagram save feedback', () => {
  it.each([
    ['saving', 'Saving...'],
    ['saved', 'Saved just now'],
    ['retrying', 'Could not save. Retrying...'],
  ] as const)('shows the %s state exactly as notes do', (status, text) => {
    render(<SaveStatusIndicator status={status} />);
    expect(screen.getByRole('status')).toHaveTextContent(text);
    expect(screen.getByRole('status')).toHaveAttribute('data-state', status);
  });

  it('offers the same conflict choices as notes when the file changed outside Anehalo', async () => {
    const choices = renderNotice(draft);
    const user = userEvent.setup();

    expect(screen.getByRole('alert')).toHaveTextContent('This diagram changed outside Anehalo.');
    await user.click(screen.getByRole('button', { name: 'Keep mine' }));
    await user.click(screen.getByRole('button', { name: 'Load theirs' }));

    expect(choices).toEqual(['mine', 'theirs']);
  });

  it('explains a deleted file and keeps the drawing', () => {
    renderNotice({ ...draft, hasExternalChange: false, isMissing: true, error: null });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'This diagram was deleted or renamed outside Anehalo. Your drawing is kept in memory.',
    );
  });
});
