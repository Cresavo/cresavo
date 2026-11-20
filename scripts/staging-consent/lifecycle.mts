// A resource the runner is acquiring (the run's database). Cancellation can arrive while the
// acquisition is still in flight: PostgreSQL may already have created the database while the
// client is still disconnecting. Cleanup therefore waits for the attempt to settle and releases
// whenever one was made; the release itself must be safe if nothing was created (IF EXISTS).
export function acquisition() {
  let attempt: Promise<unknown> | undefined;
  return {
    /** Starts the acquisition; the result is the acquisition's own promise. */
    run<T>(acquire: () => Promise<T>): Promise<T> {
      const pending = acquire();
      attempt = pending;
      return pending;
    },
    /** Waits for an attempt in flight, then reports whether one was made at all. */
    async settled() {
      if (!attempt) return false;
      await attempt.catch(() => {});
      return true;
    },
  };
}

/** Runs a cleanup and reports whether it completed; a throw is reported, never passed on. */
export async function settles(cleanup: () => Promise<unknown>) {
  try { await cleanup(); return true; } catch { return false; }
}
