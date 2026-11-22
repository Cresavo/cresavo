import { createHmac } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { postgresStore } from "./rate-limit";

// State for owner sign-in lockout and the reset-mail quota, kept apart from the shared rate-limit buckets:
// nothing here is scanned by, or evicted for, ordinary rate checks, and each part has its own small cap, so
// pressure on one cannot change the behaviour of another. Memory (one process) or the existing
// "RateLimitBucket" table (shared by every worker), chosen by RATE_LIMIT_STORE like the rest.
//
// Lockout rules: five real password failures within 15 minutes lock the address; the first lock lasts 15
// minutes and each further lock within a day doubles it, up to 8 hours. A failure is counted only after
// the password was checked and found wrong, in one atomic step; a correct password checks the lock and
// clears the failures in one atomic step. There are no reservations, so nothing counts until it failed.

const FAIL_WINDOW_MS = 15 * 60_000;
const STRIKE_WINDOW_MS = 24 * 3600_000;
const BASE_LOCK_MS = 15 * 60_000;
const MAX_LOCK_MS = 8 * 3600_000;
export const LOCK_THRESHOLD = 5;
/** Addresses tracked at once. Past it expired entries go first, then failure counts; an active lock only as a last resort. */
export const GUARD_CAP = 20_000;
export const MAILBOX_LIMIT = 3;
export const MAILBOX_WINDOW_MS = 15 * 60_000;
export const MAILBOX_CAP = 1_000;
const PRUNE_EVERY_MS = 60_000;

/** How long the nth lock within a day lasts. */
export const lockDurationMs = (strikes: number) => Math.min(MAX_LOCK_MS, BASE_LOCK_MS * 2 ** Math.max(0, strikes - 1));

export interface LoginGuard {
  /** True while the address is locked. */
  locked(email: string, now?: number): Promise<boolean>;
  /** One password was checked and was wrong. The fifth in a window locks the address. */
  failed(email: string, now?: number): Promise<void>;
  /** A correct password: false when the address is locked, otherwise forgets its failures and strikes. */
  succeeded(email: string, now?: number): Promise<boolean>;
  /** Forgets everything, the lock included (a password reset proves control of the mailbox). */
  lift(email: string): Promise<void>;
}

export interface MailboxQuota {
  /** True while the mailbox may be sent another reset mail. Uses nothing up. */
  available(email: string, now?: number): Promise<boolean>;
  /** A reset mail was sent. */
  spend(email: string, now?: number): Promise<void>;
}

// ---- Memory -----------------------------------------------------------------------------------------------

interface Entry { failures: number; failuresUntil: number; strikes: number; strikesUntil: number; lockedUntil: number }
const isLive = (e: Entry, now: number) => e.lockedUntil > now || e.failuresUntil > now || e.strikesUntil > now;

export function memoryLoginGuard(): LoginGuard & { size(): number } {
  const entries = new Map<string, Entry>();
  let lastPrune = 0;

  function prune(now: number, force = false) {
    if (!force && now - lastPrune < PRUNE_EVERY_MS) return;
    lastPrune = now;
    for (const [key, entry] of entries) if (!isLive(entry, now)) entries.delete(key);
  }

  function makeRoom(now: number) {
    if (entries.size < GUARD_CAP) return;
    prune(now, true);
    if (entries.size < GUARD_CAP) return;
    // Nothing expired: drop the oldest address that is only counting failures, never a lock if one can be spared.
    const victim = [...entries].find(([, e]) => e.lockedUntil <= now)
      ?? [...entries].sort((a, b) => a[1].lockedUntil - b[1].lockedUntil)[0];
    if (victim) entries.delete(victim[0]);
  }

  return {
    size: () => entries.size,
    async locked(email, now = Date.now()) {
      prune(now);
      const entry = entries.get(email);
      if (!entry) return false;
      if (!isLive(entry, now)) { entries.delete(email); return false; }
      return entry.lockedUntil > now;
    },
    async failed(email, now = Date.now()) {
      prune(now);
      let entry = entries.get(email);
      if (!entry) {
        makeRoom(now);
        entry = { failures: 0, failuresUntil: 0, strikes: 0, strikesUntil: 0, lockedUntil: 0 };
        entries.set(email, entry);
      }
      if (entry.lockedUntil > now) return;
      if (entry.failuresUntil <= now) { entry.failures = 0; entry.failuresUntil = now + FAIL_WINDOW_MS; }
      if (++entry.failures < LOCK_THRESHOLD) return;
      if (entry.strikesUntil <= now) { entry.strikes = 0; entry.strikesUntil = now + STRIKE_WINDOW_MS; }
      entry.strikes++;
      entry.lockedUntil = now + lockDurationMs(entry.strikes);
      entry.failures = 0;
      entry.failuresUntil = 0;
    },
    async succeeded(email, now = Date.now()) {
      const entry = entries.get(email);
      if (entry && entry.lockedUntil > now) return false;
      entries.delete(email);
      return true;
    },
    async lift(email) { entries.delete(email); },
  };
}

export function memoryMailboxQuota(): MailboxQuota {
  const buckets = new Map<string, { count: number; until: number }>();
  const live = (email: string, now: number) => {
    const bucket = buckets.get(email);
    if (bucket && bucket.until <= now) buckets.delete(email);
    return buckets.get(email);
  };
  return {
    async available(email, now = Date.now()) { return (live(email, now)?.count ?? 0) < MAILBOX_LIMIT; },
    async spend(email, now = Date.now()) {
      const bucket = live(email, now);
      if (bucket) { bucket.count++; return; }
      if (buckets.size >= MAILBOX_CAP) {
        for (const [key, b] of buckets) if (b.until <= now) buckets.delete(key);
        if (buckets.size >= MAILBOX_CAP) buckets.delete(buckets.keys().next().value!);
      }
      buckets.set(email, { count: 1, until: now + MAILBOX_WINDOW_MS });
    },
  };
}

// ---- Postgres ---------------------------------------------------------------------------------------------

const LOCK_KEYS = ["acct:", "strike:", "lock:"] as const;
const MAILBOX_PREFIX = "mbx:";
const ADVISORY = "booking-lab:rate-store:v1";
/** Every row this module writes starts with one of these; the sweep and the caps look only at them. */
export const GUARD_PREFIXES = [...LOCK_KEYS, MAILBOX_PREFIX];

function keyOf(prefix: string, email: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("RATE_LIMIT_CONFIG_INVALID");
  return `${prefix}${createHmac("sha256", secret).update(`owner-guard:v1:${prefix}${email}`).digest("hex")}`;
}

async function database() {
  return (await import("./postgres-rate-limit")).rateLimitDatabase;
}

type Tx = Prisma.TransactionClient;

async function transact<T>(work: (tx: Tx, now: Date) => Promise<T>): Promise<T> {
  return (await database()).$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${ADVISORY}))`;
    const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
    return work(tx, now);
  }, { maxWait: 30000, timeout: 10000 });
}

const startsWith = (prefixes: readonly string[]) => ({ OR: prefixes.map((prefix) => ({ key: { startsWith: prefix } })) });

/** Room for one more address: expired rows first, then failure counters. An active lock is never taken. */
async function makeRoomPg(tx: Tx, now: Date) {
  const mine = startsWith(LOCK_KEYS);
  if ((await tx.rateLimitBucket.count({ where: mine })) < GUARD_CAP * 3) return;
  const expired = await tx.rateLimitBucket.findMany({ where: { AND: [mine, { expiresAt: { lte: now } }] }, orderBy: { expiresAt: "asc" }, select: { key: true }, take: 100 });
  const spare = expired.length ? expired : await tx.rateLimitBucket.findMany({ where: { key: { startsWith: "acct:" } }, orderBy: { expiresAt: "asc" }, select: { key: true }, take: 100 });
  await tx.rateLimitBucket.deleteMany({ where: { key: { in: spare.map((row) => row.key) } } });
}

export function postgresLoginGuard(): LoginGuard {
  const lockActive = async (tx: Tx, email: string, now: Date) =>
    !!(await tx.rateLimitBucket.findFirst({ where: { key: keyOf("lock:", email), expiresAt: { gt: now } }, select: { key: true } }));
  return {
    locked: (email) => transact((tx, now) => lockActive(tx, email, now)),
    failed: (email) => transact(async (tx, now) => {
      if (await lockActive(tx, email, now)) return;
      const acct = keyOf("acct:", email);
      const open = await tx.rateLimitBucket.findFirst({ where: { key: acct, expiresAt: { gt: now } } });
      if (!open) await makeRoomPg(tx, now);
      const count = (open?.count ?? 0) + 1;
      const expiresAt = open?.expiresAt ?? new Date(now.getTime() + FAIL_WINDOW_MS);
      if (count < LOCK_THRESHOLD) {
        await tx.rateLimitBucket.upsert({ where: { key: acct }, create: { key: acct, generation: "", count, expiresAt }, update: { count, expiresAt } });
        return;
      }
      const strike = keyOf("strike:", email);
      const earlier = await tx.rateLimitBucket.findFirst({ where: { key: strike, expiresAt: { gt: now } } });
      const strikes = (earlier?.count ?? 0) + 1;
      const strikeUntil = earlier?.expiresAt ?? new Date(now.getTime() + STRIKE_WINDOW_MS);
      await tx.rateLimitBucket.upsert({ where: { key: strike }, create: { key: strike, generation: "", count: strikes, expiresAt: strikeUntil }, update: { count: strikes, expiresAt: strikeUntil } });
      const lock = keyOf("lock:", email);
      const lockedUntil = new Date(now.getTime() + lockDurationMs(strikes));
      await tx.rateLimitBucket.upsert({ where: { key: lock }, create: { key: lock, generation: "", count: 1, expiresAt: lockedUntil }, update: { count: 1, expiresAt: lockedUntil } });
      await tx.rateLimitBucket.deleteMany({ where: { key: acct } });
    }),
    succeeded: (email) => transact(async (tx, now) => {
      if (await lockActive(tx, email, now)) return false;
      await tx.rateLimitBucket.deleteMany({ where: { key: { in: [keyOf("acct:", email), keyOf("strike:", email), keyOf("lock:", email)] } } });
      return true;
    }),
    lift: (email) => transact(async (tx) => {
      await tx.rateLimitBucket.deleteMany({ where: { key: { in: [keyOf("acct:", email), keyOf("strike:", email), keyOf("lock:", email)] } } });
    }),
  };
}

export function postgresMailboxQuota(): MailboxQuota {
  return {
    available: (email) => transact(async (tx, now) => {
      const row = await tx.rateLimitBucket.findFirst({ where: { key: keyOf(MAILBOX_PREFIX, email), expiresAt: { gt: now } } });
      return (row?.count ?? 0) < MAILBOX_LIMIT;
    }),
    spend: (email) => transact(async (tx, now) => {
      const key = keyOf(MAILBOX_PREFIX, email);
      const open = await tx.rateLimitBucket.findFirst({ where: { key, expiresAt: { gt: now } } });
      if (!open && (await tx.rateLimitBucket.count({ where: { key: { startsWith: MAILBOX_PREFIX } } })) >= MAILBOX_CAP) {
        const oldest = await tx.rateLimitBucket.findFirst({ where: { key: { startsWith: MAILBOX_PREFIX } }, orderBy: { expiresAt: "asc" }, select: { key: true } });
        if (oldest) await tx.rateLimitBucket.delete({ where: { key: oldest.key } });
      }
      const count = (open?.count ?? 0) + 1;
      const expiresAt = open?.expiresAt ?? new Date(now.getTime() + MAILBOX_WINDOW_MS);
      await tx.rateLimitBucket.upsert({ where: { key }, create: { key, generation: "", count, expiresAt }, update: { count, expiresAt } });
    }),
  };
}

// ---- Selection ----------------------------------------------------------------------------------------------

const memory = { guard: memoryLoginGuard(), quota: memoryMailboxQuota() };
const shared = { guard: postgresLoginGuard(), quota: postgresMailboxQuota() };

/** The stores for this deployment: shared in the database with RATE_LIMIT_STORE=postgres, otherwise per process. */
export const loginGuard = (): LoginGuard => (postgresStore() ? shared.guard : memory.guard);
export const mailboxQuota = (): MailboxQuota => (postgresStore() ? shared.quota : memory.quota);
