import type { Editor } from '@tiptap/core';
import type { Transaction } from '@tiptap/pm/state';

export interface InsertionRange {
  readonly from: number;
  readonly to: number;
}

/**
 * Runs an async step (creating a note or diagram) and returns where to insert afterwards: the
 * starting range, mapped through every edit made to the document in the meantime.
 */
export async function afterTrackingRange<Value>(
  editor: Editor,
  start: InsertionRange,
  step: () => Promise<Value>,
): Promise<{ value: Value; range: InsertionRange }> {
  let range = start;
  const follow = ({ transaction }: { transaction: Transaction }) => {
    range = {
      from: transaction.mapping.map(range.from),
      to: transaction.mapping.map(range.to),
    };
  };
  editor.on('transaction', follow);
  try {
    return { value: await step(), range };
  } finally {
    editor.off('transaction', follow);
  }
}
