// A resource the runner is acquiring (the run's database). Cancellation can arrive while the
// acquisition is still in flight: PostgreSQL may already have created the database while the
// client is still disconnecting. Cleanup therefore waits for the attempt to settle and releases
// whenever one was made; the release itself must be safe if nothing was created (IF EXISTS).
export function acquisition() {
  let attempt: Promise<unknown> | undefined;
  let mayExist = false;
  return {
    /**
     * Starts the acquisition. `notAcquired` recognises a failure that proves nothing was created
     * (a name that already existed): that must never authorise a release of someone else's resource.
     */
    run<T>(acquire: () => Promise<T>, notAcquired: (error: unknown) => boolean = () => false): Promise<T> {
      const pending = acquire();
      attempt = pending.then(() => { mayExist = true; }, error => { mayExist = !notAcquired(error); });
      return pending;
    },
    /**
     * Waits for an attempt in flight, then reports whether the resource may exist because of this
     * run: created, or failed in a way that does not rule creation out (a lost reply).
     */
    async settled() {
      if (!attempt) return false;
      await attempt;
      return mayExist;
    },
  };
}

/** Runs a cleanup and reports whether it completed; a throw is reported, never passed on. */
export async function settles(cleanup: () => Promise<unknown>) {
  try { await cleanup(); return true; } catch { return false; }
}

/** True for PostgreSQL's duplicate_database (42P04), as Prisma's driver adapter reports it. */
export function databaseAlreadyExisted(error: unknown) {
  const cause = (error as { meta?: { driverAdapterError?: { cause?: { originalCode?: string } } } })?.meta?.driverAdapterError?.cause;
  return cause?.originalCode === "42P04";
}

/**
 * Every signal that ends the runner runs the same cleanup: Ctrl-C, a stop request and a closed
 * terminal (SIGHUP). Playwright's own handlers for these are switched off in launchBrowser.
 */
export const CLEANUP_SIGNALS = ["SIGINT", "SIGTERM", "SIGHUP"] as const;

/**
 * Browsers the runner starts. A signal can arrive while a launch is still pending; cleanup then
 * waits for it and closes what it produced, so no browser or profile outlives the run. Once
 * cleanup has begun, a launch that finishes closes its browser itself and no new one starts.
 */
export function launchedBrowsers<T extends { close(): Promise<void> }>() {
  const pending = new Set<Promise<unknown>>();
  const started: T[] = [];
  let closing = false;
  return {
    start(launch: () => Promise<T>): Promise<T> {
      if (closing) return Promise.reject(new Error("STAGING_STOPPING"));
      const run = (async () => {
        const browser = await launch();
        if (closing) { await browser.close().catch(() => {}); throw new Error("STAGING_STOPPING"); }
        started.push(browser);
        return browser;
      })();
      // Cleanup-only: it settles on both paths, so a failed launch is reported once (through the
      // caller's `run`) and never again as an unhandled rejection of this tracking promise.
      const tracked: Promise<void> = run.then(() => {}, () => {}).then(() => { pending.delete(tracked); });
      pending.add(tracked);
      return run;
    },
    async closeAll() {
      closing = true;
      await Promise.allSettled([...pending]);
      for (const browser of started.splice(0)) await browser.close().catch(() => {});
    },
  };
}
