// Ids of records a change creates. A tab shows a change at once and commits it under the booking
// lock a moment later, on possibly newer data: inside one operation both runs must hand out the
// same ids, so a follow-up change made from the preview finds this record and never another tab's.

let scope: { op: string; next: number } | undefined;

/** A new record's id: `${prefix}-${seq}` normally, `${prefix}-${op}-${n}` inside an operation. */
export function recordId(prefix: string, seq: number | string): string {
  return scope ? `${prefix}-${scope.op}-${scope.next++}` : `${prefix}-${seq}`;
}

/** Runs one reducer call with ids drawn from `op` (numbered from 0), or with sequence ids when there is none. */
export function withRecordIds<T>(op: string | undefined, run: () => T): T {
  const previous = scope;
  scope = op ? { op, next: 0 } : undefined;
  try {
    return run();
  } finally {
    scope = previous;
  }
}
