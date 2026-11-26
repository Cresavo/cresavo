/** Takes a lock so a second call is ignored until the first finishes. */
export function claim(lock: { current: boolean }): boolean {
  if (lock.current) return false;
  lock.current = true;
  return true;
}

/**
 * Takes the start lock first, then waits for an in-flight save.
 * A second call while the first is waiting is refused.
 */
export async function waitToStart(
  starting: { current: boolean },
  saving: { current: Promise<unknown> | null },
): Promise<boolean> {
  if (!claim(starting)) return false;
  if (saving.current) await saving.current;
  return true;
}
