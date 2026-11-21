import { useCallback } from 'react';
import { logFailure } from '@/features/diagnostics/error-logging';
import { classifyElementLink } from '@/features/links/element-links';
import { openWebLink } from '@/features/links/web-links';
import { useWorkspaceStore } from '@/store/use-workspace-store';

/** Opens a diagram element's link: vault notes and diagrams in the app, web pages in a browser. */
export function useElementLinkOpener(): (link: string) => void {
  const openItem = useWorkspaceStore((state) => state.openItem);
  const reportError = useWorkspaceStore((state) => state.reportError);
  return useCallback(
    (link: string) => {
      const target = classifyElementLink(link);
      if (target.kind === 'blocked') {
        logFailure('blocked-link');
        reportError({ code: 'invalid-path', message: 'Anehalo does not open this kind of link.' });
        return;
      }
      const opened = target.kind === 'item' ? openItem(target.path) : openWebLink(target.url);
      void opened.then((result) => {
        if (!result.ok) reportError(result.error);
      });
    },
    [openItem, reportError],
  );
}
