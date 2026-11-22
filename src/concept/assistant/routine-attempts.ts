// Keeps the studio's routine runner from repeating itself. A run the server refuses is tried again on a later
// clock tick, but only once per salon clock minute, and its proposal and toast are made once per routine and slot.
// Everything is keyed by salon (the snapshot lifetime), so another salon's routine of the same id is its own.

export interface RoutineAttempts {
  /** True when this routine's slot has not been tried in this salon minute yet; records the try. */
  shouldAttempt(salon: string, routineId: string, slot: string, today: string, minutes: number): boolean;
  /** True the first time a routine's slot is announced in this salon; later calls (retries) are false. */
  firstAnnouncement(salon: string, routineId: string, slot: string): boolean;
}

export function createRoutineAttempts(): RoutineAttempts {
  const attempted = new Map<string, string>();
  const announced = new Set<string>();
  return {
    shouldAttempt(salon, routineId, slot, today, minutes) {
      const key = `${salon}|${routineId}`;
      const attempt = `${slot} ${today} ${minutes}`;
      if (attempted.get(key) === attempt) return false;
      attempted.set(key, attempt);
      return true;
    },
    firstAnnouncement(salon, routineId, slot) {
      const key = `${salon}|${routineId}|${slot}`;
      if (announced.has(key)) return false;
      announced.add(key);
      return true;
    },
  };
}
