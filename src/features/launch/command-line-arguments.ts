import { failure, success, type RepositoryResult } from '@/features/storage/repository-result';

export type CommandLineAction = 'open' | 'new-note' | 'background';

export function parseCommandLineArguments(
  launchArguments: readonly string[],
): RepositoryResult<CommandLineAction | null> {
  let action: CommandLineAction | null = null;
  for (const argument of launchArguments) {
    const next =
      argument === '--open'
        ? 'open'
        : argument === '--new-note'
          ? 'new-note'
          : argument === '--autostart'
            ? 'background'
            : null;
    if (!next)
      return failure({
        code: 'invalid-name',
        message: 'Unknown launch argument. Use --open or --new-note.',
      });
    if (action && action !== next)
      return failure({
        code: 'invalid-name',
        message: 'Choose only one launch action: --open or --new-note.',
      });
    action = next;
  }
  return success(action);
}
