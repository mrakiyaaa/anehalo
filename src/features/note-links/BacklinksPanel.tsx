import { FileText, Link2 } from 'lucide-react';
import { Icon } from '@/components/ui/Icon';
import { useWorkspaceStore } from '@/store/use-workspace-store';
import { folderTone } from '@/lib/folder-tone';
import { pathName } from '@/features/storage/storage-paths';
import { vaultItems } from '@/features/storage/vault-items';

/**
 * The notes and diagrams that link to (or embed) a note or diagram. Open by default under a
 * note; a diagram keeps it folded so the canvas keeps its height.
 */
export function BacklinksPanel({
  path,
  defaultOpen = true,
}: {
  path: string;
  defaultOpen?: boolean;
}) {
  const index = useWorkspaceStore((state) => state.links);
  const tree = useWorkspaceStore((state) => state.tree);
  const openItem = useWorkspaceStore((state) => state.openItem);
  const disabled = useWorkspaceStore((state) => state.isClosing || state.isMutating);
  const sources = index.backlinks.get(path) ?? [];
  const backlinks = vaultItems(tree).filter((item) => sources.includes(item.relativePath));
  return (
    <details className="backlinks-panel" open={defaultOpen}>
      <summary>
        <Link2 size={16} aria-hidden="true" />
        <span>Linked from</span>
        <span className="backlink-count">{backlinks.length}</span>
      </summary>
      {backlinks.length ? (
        <ul>
          {backlinks.map((item) => (
            <li key={item.relativePath}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  void openItem(item.relativePath);
                }}
              >
                {item.kind === 'diagram' ? (
                  <Icon name="shapes" />
                ) : (
                  <FileText size={15} aria-hidden="true" />
                )}
                <span>{item.title}</span>
                <span className={`note-picker-folder tone-${folderTone(item.folder)}`}>
                  {item.folder ? pathName(item.folder) : 'Vault root'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p>
          No links here yet. Use <kbd>/page</kbd> in another note to connect your thoughts.
        </p>
      )}
    </details>
  );
}
