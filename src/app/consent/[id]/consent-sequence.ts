// Orders the consent page's requests. Reads (opening or reopening the link, checking the status
// again) and decisions share one generation: only the latest request may change what the page
// shows, so a slow read can never bring back the buttons after a decision. A read started while a
// decision is in flight waits for it, so it sees the salon's state after that decision.
export function consentSequence() {
  let generation = 0;
  let inFlight: Promise<void> | null = null;
  const begin = () => { const mine = ++generation; return () => mine === generation; };
  return {
    /** Runs a decision. `current()` is false once a later request has started. */
    async decide<T>(run: (current: () => boolean) => Promise<T>): Promise<T> {
      const current = begin();
      let done!: () => void;
      const settled = new Promise<void>(resolve => { done = resolve; });
      inFlight = settled;
      try { return await run(current); }
      finally { if (inFlight === settled) inFlight = null; done(); }
    },
    /** Runs a read after any decision in flight. `current()` is false once a later request has started. */
    async read<T>(run: (current: () => boolean) => Promise<T>): Promise<T> {
      while (inFlight) await inFlight;
      return run(begin());
    },
  };
}
