import { failure, success, type RepositoryResult } from '@/features/storage/repository-result';

export type CommandLineAction =
  /** Shows Anehalo, and opens the note or diagram at `path` when one is given. */
  | { readonly kind: 'open'; readonly path: string | null }
  | { readonly kind: 'new-note' }
  | { readonly kind: 'new-diagram' }
  /** Started with Windows: stay in the tray. */
  | { readonly kind: 'background' };

const usage = 'Use --open [file], --new-note or --new-diagram.';

function flagAction(argument: string): CommandLineAction | null {
  if (argument === '--new-note') return { kind: 'new-note' };
  if (argument === '--new-diagram') return { kind: 'new-diagram' };
  if (argument === '--autostart') return { kind: 'background' };
  return null;
}

function sameAction(first: CommandLineAction, second: CommandLineAction): boolean {
  return (
    first.kind === second.kind &&
    (first.kind !== 'open' || second.kind !== 'open' || first.path === second.path)
  );
}

export function parseCommandLineArguments(
  launchArguments: readonly string[],
): RepositoryResult<CommandLineAction | null> {
  let action: CommandLineAction | null = null;
  for (let index = 0; index < launchArguments.length; index += 1) {
    const argument = launchArguments[index] ?? '';
    let next: CommandLineAction | null;
    if (argument === '--open') {
      const path = launchArguments[index + 1];
      const hasPath = path !== undefined && !path.startsWith('--');
      if (hasPath) index += 1;
      next = { kind: 'open', path: hasPath ? path : null };
    } else next = flagAction(argument);
    if (!next)
      return failure({ code: 'invalid-name', message: `Unknown launch argument. ${usage}` });
    if (action && !sameAction(action, next))
      return failure({ code: 'invalid-name', message: `Choose only one launch action. ${usage}` });
    action = next;
  }
  return success(action);
}
