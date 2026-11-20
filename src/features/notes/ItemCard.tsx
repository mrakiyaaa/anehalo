import { Icon } from '@/components/ui/Icon';
import { ItemMenu } from '@/components/ui/ItemMenu';
import { pathName } from '@/features/storage/storage-paths';
import type { VaultItem } from '@/features/storage/vault-items';
import { DiagramThumbnail } from '@/features/thumbnails/DiagramThumbnail';
import { folderTone } from '@/lib/folder-tone';
import { formatRelativeTime } from '@/lib/relative-time';
import { mergeClassNames } from '@/lib/utils';
import { useItemActions } from './use-item-actions';

interface ItemCardProps {
  readonly item: VaultItem;
  readonly currentTime: number;
}

/** A Home card for a note (title and snippet) or a diagram (thumbnail and title). */
export function ItemCard({ item, currentTime }: ItemCardProps) {
  const actions = useItemActions(item);
  const isDiagram = item.kind === 'diagram';
  return (
    <ItemMenu
      kind={item.kind}
      name={item.title}
      path={item.relativePath}
      folder={item.folder}
      onOpen={actions.open}
      onRename={actions.rename}
      {...(actions.move ? { onMove: actions.move } : {})}
      onDelete={actions.remove}
    >
      <article
        className={mergeClassNames(
          'note-card',
          `tone-${folderTone(item.folder)}`,
          isDiagram && 'diagram-card',
        )}
        title={item.relativePath}
        data-kind={item.kind}
      >
        <button
          type="button"
          className="note-card-open"
          aria-label={`Open ${item.title}`}
          onClick={actions.open}
        />
        {isDiagram && <DiagramThumbnail diagram={item} />}
        <h3>
          {isDiagram && <Icon name="shapes" className="diagram-card-icon" />}
          {item.title}
        </h3>
        {!isDiagram && <p>{item.snippet || 'An empty note, ready for a thought.'}</p>}
        <div className="note-card-footer">
          <span className="folder-chip" title={item.folder ?? 'Vault root'}>
            {item.folder ? pathName(item.folder) : 'Vault root'}
          </span>
          <span className="note-edited-time">
            {formatRelativeTime(item.modifiedAt, currentTime)}
          </span>
        </div>
      </article>
    </ItemMenu>
  );
}
