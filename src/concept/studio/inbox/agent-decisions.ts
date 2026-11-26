// The owner's decisions on agent proposals, kept in the browser until the
// server no longer lists the proposal as pending. The studio applies an
// approval to its own data before the server hears of it, so a decision that
// did not reach the server must never be offered, or applied, a second time.

export type AgentDecision = "approved" | "declined" | "failed";

export interface DecisionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface Recorded {
  decision: AgentDecision;
  /** Epoch milliseconds when the decision was made. */
  at: number;
}

type Records = Record<string, Recorded>;

const STORAGE_KEY = "cresavo-agent-decisions";
const DECISIONS = new Set<string>(["approved", "declined", "failed"]);

function parse(raw: string | null): Records {
  if (!raw) return {};
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return {};
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => DECISIONS.has(entry?.decision) && typeof entry?.at === "number"));
  } catch {
    return {};
  }
}

/** Decisions in `storage`, or in memory where the browser keeps none. */
export function decisionOutbox(storage: () => DecisionStorage | undefined) {
  let memory: Records = {};
  const read = (): Records => {
    try {
      const store = storage();
      return store ? parse(store.getItem(STORAGE_KEY)) : memory;
    } catch {
      return memory;
    }
  };
  const write = (records: Records) => {
    memory = records;
    try {
      storage()?.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch {
      // Memory still holds them for this page.
    }
  };

  return {
    /**
     * Decides once per proposal: `apply` runs only for a first approval, and
     * the decision is kept before `send` tells the server. Returns the log ID
     * from `apply`, false when it could not apply, null otherwise.
     */
    decide(id: string, approve: boolean, apply: () => string | null | false, send: (id: string, decision: AgentDecision) => Promise<void>, at = Date.now()) {
      if (read()[id]) return null;
      const logId = approve ? apply() : null;
      const decision: AgentDecision = !approve ? "declined" : logId !== false ? "approved" : "failed";
      write({ ...read(), [id]: { decision, at } });
      void send(id, decision).catch(() => undefined);
      return logId;
    },

    /** Proposals the owner has not decided on. */
    undecided<T extends { id: string }>(proposals: T[]): T[] {
      const records = read();
      return proposals.filter((proposal) => !records[proposal.id]);
    },

    /**
     * Brings the server up to date from a pending list whose request started
     * at `listedAt`. A decision on a proposal the server still lists is sent
     * again; one the list no longer has is settled and forgotten. Decisions
     * made after the request started are kept, since the list predates them.
     */
    async reconcile(pendingIds: string[], listedAt: number, send: (id: string, decision: AgentDecision) => Promise<void>) {
      const pending = new Set(pendingIds);
      const records = read();
      const kept = Object.entries(records).filter(([id, entry]) => pending.has(id) || entry.at >= listedAt);
      if (kept.length < Object.keys(records).length) write(Object.fromEntries(kept));
      await Promise.all(kept.filter(([id]) => pending.has(id)).map(([id, entry]) => send(id, entry.decision).catch(() => undefined)));
    },
  };
}
