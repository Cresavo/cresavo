// Where the web call keeps what must survive between requests and server
// instances: the call counters (per address, per page session, per day) and
// the calls that are running, with the moment each must be hung up.
//
// The public demo runs with PUBLIC_READONLY=1, so the studio database is off
// there. The one database it does have is the assistant-pairing database
// (PAIRING_DATABASE_URL, docs/CONNECT_AI_ASSISTANT.md), and its `PairBudget`
// table is exactly a counter with an expiry that the nightly pairing sweep
// already cleans up. The web call borrows that table under the `voice:` key
// prefix: no new table, no new database.
//
// Without that database the web call refuses to start in production
// (`ledgerFor` returns null). Process memory is only used in development and
// tests, where nothing is billed to a real visitor.

import { pairingDatabaseUrl } from "../../../../scripts/pairing-config.mjs";

export type Take = { ok: true } | { ok: false; retryAfter: number };

export interface CallLedger {
  readonly kind: "pairing-db" | "memory";
  /** Counts one use of `bucket` in the current fixed window of `periodMs`; refuses at `limit`. */
  take(bucket: string, limit: number, periodMs: number, now: number): Promise<Take>;
  /** Records a running call and the moment it must end. */
  register(callId: string, deadline: number): Promise<void>;
  /** Running calls whose deadline has passed, oldest first. */
  overdue(now: number, max: number): Promise<string[]>;
  /** Whether the call is registered and not yet ended. */
  isRunning(callId: string): Promise<boolean>;
  /** Marks a call as ended, once OpenAI confirmed the hang-up. True when it was still running. */
  finish(callId: string): Promise<boolean>;
  /** Every call still running. Used when the kill switch is off. */
  running(max: number): Promise<string[]>;
}

const windowEnd = (now: number, periodMs: number) => (Math.floor(now / periodMs) + 1) * periodMs;
/** A finished or overdue call row stays a day so it can still be found and hung up. */
const KEEP_MS = 24 * 3_600_000;
const CALL_PREFIX = "voice:call:";

/** For tests and local development only. */
export function memoryLedger(): CallLedger {
  const counters = new Map<string, { count: number; until: number }>();
  const calls = new Map<string, { deadline: number; running: boolean }>();
  return {
    kind: "memory",
    async take(bucket, limit, periodMs, now) {
      const until = windowEnd(now, periodMs);
      const key = `${bucket}:${until}`;
      for (const [k, v] of counters) if (v.until <= now) counters.delete(k);
      const current = counters.get(key) ?? { count: 0, until };
      if (current.count >= limit) return { ok: false, retryAfter: Math.max(1, Math.ceil((until - now) / 1000)) };
      counters.set(key, { count: current.count + 1, until });
      return { ok: true };
    },
    async register(callId, deadline) {
      calls.set(callId, { deadline, running: true });
    },
    async overdue(now, max) {
      return [...calls].filter(([, c]) => c.running && c.deadline <= now).sort((a, b) => a[1].deadline - b[1].deadline).slice(0, max).map(([id]) => id);
    },
    async isRunning(callId) {
      return calls.get(callId)?.running === true;
    },
    async finish(callId) {
      const call = calls.get(callId);
      if (!call?.running) return false;
      call.running = false;
      return true;
    },
    async running(max) {
      return [...calls].filter(([, c]) => c.running).slice(0, max).map(([id]) => id);
    },
  };
}

/** The few raw queries the ledger needs; satisfied by a Prisma client. */
export interface SqlClient {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
}

export function pairBudgetLedger(db: () => SqlClient): CallLedger {
  return {
    kind: "pairing-db",
    async take(bucket, limit, periodMs, now) {
      const until = windowEnd(now, periodMs);
      const key = `voice:${bucket}:${until}`;
      const rows = await db().$queryRaw<{ count: number }[]>`
        INSERT INTO "PairBudget" ("key", "count", "expiresAt") VALUES (${key}, 1, ${new Date(until)})
        ON CONFLICT ("key") DO UPDATE SET "count" = "PairBudget"."count" + 1
        WHERE "PairBudget"."count" < ${limit} RETURNING "count"`;
      return rows.length > 0 ? { ok: true } : { ok: false, retryAfter: Math.max(1, Math.ceil((until - now) / 1000)) };
    },
    async register(callId, deadline) {
      // count 1 = running, 0 = ended. expiresAt = deadline + a day, so the pairing sweep keeps overdue rows.
      const key = CALL_PREFIX + callId;
      await db().$queryRaw`
        INSERT INTO "PairBudget" ("key", "count", "expiresAt") VALUES (${key}, 1, ${new Date(deadline + KEEP_MS)})
        ON CONFLICT ("key") DO NOTHING RETURNING "count"`;
    },
    async overdue(now, max) {
      const rows = await db().$queryRaw<{ key: string }[]>`
        SELECT "key" FROM "PairBudget" WHERE "key" LIKE ${CALL_PREFIX + "%"} AND "count" = 1 AND "expiresAt" <= ${new Date(now + KEEP_MS)}
        ORDER BY "expiresAt" LIMIT ${max}`;
      return rows.map((row) => row.key.slice(CALL_PREFIX.length));
    },
    async isRunning(callId) {
      const rows = await db().$queryRaw<{ key: string }[]>`
        SELECT "key" FROM "PairBudget" WHERE "key" = ${CALL_PREFIX + callId} AND "count" = 1`;
      return rows.length > 0;
    },
    async finish(callId) {
      const rows = await db().$queryRaw<{ key: string }[]>`
        UPDATE "PairBudget" SET "count" = 0 WHERE "key" = ${CALL_PREFIX + callId} AND "count" = 1 RETURNING "key"`;
      return rows.length > 0;
    },
    async running(max) {
      const rows = await db().$queryRaw<{ key: string }[]>`
        SELECT "key" FROM "PairBudget" WHERE "key" LIKE ${CALL_PREFIX + "%"} AND "count" = 1 ORDER BY "expiresAt" LIMIT ${max}`;
      return rows.map((row) => row.key.slice(CALL_PREFIX.length));
    },
  };
}

type Env = Record<string, string | undefined>;

const holder = globalThis as typeof globalThis & { cresavoWebCallLedger?: CallLedger };

/**
 * The ledger this deployment uses: the pairing database when pairing is on and
 * its URL is set; process memory outside production; otherwise null, and the
 * web call stays closed. `pairingClient` is only called on first use.
 */
export function ledgerFor(env: Env, pairingClient: () => SqlClient): CallLedger | null {
  if (env.ASSISTANT_PAIRING === "1" && pairingDatabaseUrl(env)) return (holder.cresavoWebCallLedger ??= pairBudgetLedger(pairingClient));
  if (env.NODE_ENV !== "production" && env.VERCEL !== "1") return (holder.cresavoWebCallLedger ??= memoryLedger());
  return null;
}
