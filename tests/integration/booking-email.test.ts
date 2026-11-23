import { randomBytes, randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../../src/app/api/public/salons/[slug]/bookings/route";
import { POST as VIEW } from "../../src/app/api/public/salons/[slug]/bookings/[id]/route";
import { addressProof } from "../../scripts/client-address.mjs";
import { createDatabaseClient } from "../../scripts/database.mjs";
import { acceptedTerms, type AcceptedTerms } from "../../src/concept/booking/public-terms";
import { connectionError, fail, ok, type PortResult } from "../../src/concept/connections/core";
import type { EmailMessage, EmailPort, EmailReceipt } from "../../src/concept/connections/ports/email";
import { deliverDue, drainPendingEffects, EFFECT_LEASE_MS, EFFECT_MAX_ATTEMPTS, SIMULATED_SINKS, type EffectSink } from "../../src/concept/store/effect-outbox";
import { PostgresStudioStore } from "../../src/concept/store/postgres-studio-store";
import { db } from "../../src/lib/db";
import { createOwnerAccount } from "../../src/lib/owner-accounts";
import { messageSink } from "../../src/lib/message-sink";
import { issuedAtToken } from "../../src/lib/public-issued-at";

// A public booking, then the outbox: exactly one e-mail, none twice, a
// permanent failure not retried, a retryable one retried. The e-mail adapter
// is a recorder: no provider exists and nothing is sent. The store's clock is
// fixed so the dates are too. All data is fictional.

const run = randomUUID().slice(0, 8);
const SECRET = "synthetic-address-secret";
const CLOCK = new Date("2026-11-16T10:00:00+01:00").getTime();
const DATE = "2026-11-24";

const holder = vi.hoisted(() => ({ store: undefined as unknown as import("../../src/concept/store/postgres-studio-store").PostgresStudioStore }));
vi.mock("../../src/lib/owner-store", async (importOriginal) => ({ ...(await importOriginal<object>()), ownerStore: () => holder.store }));

const mails: EmailMessage[] = [];
let outcome: PortResult<EmailReceipt> = ok({ id: "m-1", to: [] }, "sent");
/** Holds the provider call until released, to stand in for a slow request. */
let providerGate: Promise<void> | undefined;
let providerCalled: (() => void) | undefined;
const registry = { resolve: async () => ({ adapter: { info: { provider: "resend" }, send: async (m: EmailMessage) => { providerCalled?.(); await providerGate; return (mails.push(m), outcome); } } as unknown as EmailPort, live: true, reason: "live" as const }) };
const sinks = { ...SIMULATED_SINKS, message: messageSink(db as unknown as PrismaClient, registry) };

let tenantId = "";
let slug = "";
let serviceId = "";
let staffId = "";
let terms!: AcceptedTerms;
let calls = 0;

beforeAll(async () => {
  vi.stubEnv("OWNER_ACCOUNTS_ENABLED", "1");
  vi.stubEnv("PUBLIC_BOOKING_LIVE", "1");
  vi.stubEnv("SESSION_SECRET", randomBytes(32).toString("hex"));
  vi.stubEnv("BOOKING_ADDRESS_SECRET", SECRET);
  // The deployment means e-mail to go out for real: the store stages these effects as live (the adapter below only records).
  vi.stubEnv("CONCEPT_CONNECTIONS_LIVE", "1");
  vi.stubEnv("CONCEPT_EMAIL_PROVIDER", "resend");
  holder.store = new PostgresStudioStore({ prisma: db as unknown as PrismaClient, hmacSecret: randomBytes(32).toString("hex"), sinks, now: async () => CLOCK });
  const account = await createOwnerAccount({ email: `${randomUUID().slice(0, 8)}-${run}@example.test`, password: "a long fictional passphrase", salonName: `Salong Brev ${run}`, language: "en" });
  if (!account.ok) throw new Error("sign-up failed");
  tenantId = account.tenantId;
  const { state } = (await holder.store.load(tenantId))!;
  slug = state.salon.slug;
  const added = await holder.store.apply(tenantId, {
    type: "service/add",
    service: { name: "Fictional foot care", category: state.categories[0].id, duration: 60, price: 500, description: "Fictional", staffIds: [state.staff[0].id] },
  });
  if (!added.ok) throw new Error("service not added");
  serviceId = added.state.services[0].id;
  staffId = state.staff[0].id;
  terms = acceptedTerms(added.state, added.state.services[0]);
});

beforeEach(() => {
  providerGate = undefined;
  providerCalled = undefined;
  mails.length = 0;
  outcome = ok({ id: "m-1", to: [] }, "sent");
});

// Each test is about its own effect: whatever one leaves pending is not another's to deliver.
afterEach(async () => {
  await db.$executeRaw`UPDATE tenant_effect SET status = 'cancelled' WHERE tenant_id = ${tenantId} AND status = 'pending'`;
});

afterAll(async () => {
  await db.ownerAccount.deleteMany({ where: { email: { endsWith: `-${run}@example.test` } } });
  for (const table of ["tenant_effect", "tenant_idempotency", "tenant_action", "tenant_state"])
    await db.$executeRawUnsafe(`DELETE FROM ${table} WHERE tenant_id = $1`, tenantId);
  vi.unstubAllEnvs();
  await db.$disconnect();
});

function book(start: number, key: string = randomUUID(), phone = `0735551${100 + ++calls}`, date = DATE) {
  const ip = `10.8.${Math.floor(++calls / 250)}.${calls % 250}`;
  const body = {
    serviceId, staffId, date, start, name: "Lisa Berg", phone, email: "lisa@example.test", language: "en", website: "",
    terms, issuedAt: issuedAtToken(tenantId, slug, Date.now() - 10_000),
  };
  return POST(new NextRequest(`http://localhost/api/public/salons/${slug}/bookings`, {
    method: "POST", body: JSON.stringify(body),
    headers: { "content-type": "application/json", host: "localhost", origin: "http://localhost", "idempotency-key": key, "x-booking-client-ip": ip, "x-booking-client-proof": addressProof(ip, SECRET) },
  }), { params: Promise.resolve({ slug }) });
}

const delivery = () => db.$queryRaw<Array<{ delivery: Record<string, unknown> | null }>>`
  SELECT payload->'delivery' AS delivery FROM tenant_effect WHERE tenant_id = ${tenantId} AND payload->>'port' = 'email' ORDER BY seq DESC LIMIT 1`;
const emailEffects = () => db.$queryRaw<Array<{ status: string; attempts: number }>>`
  SELECT status, attempts FROM tenant_effect WHERE tenant_id = ${tenantId} AND payload->>'port' = 'email' ORDER BY seq DESC LIMIT 1`;
const drain = (now = CLOCK) => drainPendingEffects({ prisma: db as unknown as PrismaClient, sinks, tenants: [tenantId], now: async () => now });

describe("the booking confirmation e-mail", () => {
  it("sends exactly once for one public booking, whatever replays or drains follow", async () => {
    const key = randomUUID();
    const phone = "0735551999";
    const first = await book(540, key, phone);
    expect(first.status).toBe(201);
    expect(mails).toHaveLength(1);
    expect(mails[0]).toMatchObject({ to: ["lisa@example.test"] });
    expect(mails[0].idempotencyKey).toBeTruthy();
    expect(await emailEffects()).toEqual([{ status: "delivered", attempts: 1 }]);

    expect((await book(540, key, phone)).status).toBe(201);
    expect(await drain()).toEqual({ delivered: 0, retried: 0, failed: 0 });
    expect(mails).toHaveLength(1);
  });

  it("gives the e-mail a link that opens the booking, and keeps the token out of the log", async () => {
    const { ref } = await (await book(600)).json();
    const token = /#t=(v1\.[^\s"]+)/.exec(mails[0].text)![1];
    // The token is good for a week after the visit; the store's clock is fixed, so the check's is too.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(CLOCK);
    const view = await VIEW(new NextRequest(`http://localhost/api/public/salons/${slug}/bookings/${ref}`, {
      method: "POST", body: JSON.stringify({ token }),
      headers: { "content-type": "application/json", host: "localhost", origin: "http://localhost", "x-booking-client-ip": "10.8.99.1", "x-booking-client-proof": addressProof("10.8.99.1", SECRET) },
    }), { params: Promise.resolve({ slug, id: ref }) }).finally(() => vi.useRealTimers());
    expect(view.status).toBe(200);
    expect((await view.json()).booking).toMatchObject({ date: DATE, start: 600, status: "booked" });

    const leaks = await db.$queryRaw<Array<{ n: number }>>`
      SELECT (SELECT count(*) FROM tenant_action WHERE tenant_id = ${tenantId} AND action::text LIKE '%v1.%')::int
           + (SELECT count(*) FROM tenant_effect WHERE tenant_id = ${tenantId} AND (payload::text LIKE '%#t=%' OR payload::text LIKE ${`%${token.split(".")[3]}%`}))::int AS n`;
    expect(leaks[0].n).toBe(0);
  });

  it("marks a permanent failure failed at once, with no retry", async () => {
    outcome = fail(connectionError("email", "resend", "invalid_input"));
    expect((await book(660)).status).toBe(201);
    expect(mails).toHaveLength(1);
    expect(await emailEffects()).toEqual([{ status: "failed", attempts: 1 }]);
    expect(holder.store.store_metrics().failedEffects).toBeGreaterThanOrEqual(1);
    await drain(CLOCK + 2 * 3_600_000);
    expect(mails).toHaveLength(1);
  });

  it("retries a retryable failure later, with the same idempotency key", async () => {
    outcome = fail(connectionError("email", "resend", "provider_unavailable"));
    expect((await book(720)).status).toBe(201);
    expect(await emailEffects()).toEqual([{ status: "pending", attempts: 1 }]);
    // The first attempt froze the message; it holds no address and no token.
    const [{ delivery: frozen }] = await delivery();
    expect(frozen).toMatchObject({ firstAttemptAt: expect.any(Number), from: expect.stringContaining("bookings@") });
    expect(JSON.stringify(frozen)).not.toMatch(/lisa@example|v1\./);
    expect(await drain(CLOCK)).toEqual({ delivered: 0, retried: 0, failed: 0 });

    outcome = ok({ id: "m-2", to: [] }, "sent");
    expect(await drain(CLOCK + 3_600_000)).toEqual({ delivered: 1, retried: 0, failed: 0 });
    expect(mails).toHaveLength(2);
    expect(mails[1].idempotencyKey).toBe(mails[0].idempotencyKey);
    expect(await emailEffects()).toEqual([{ status: "delivered", attempts: 2 }]);
    expect((await delivery())[0].delivery).toEqual({ sent: true, firstAttemptAt: frozen!.firstAttemptAt });
  });

  it("keeps a timed-out send's claim past its lease, so no second worker can race it", async () => {
    outcome = fail(connectionError("email", "resend", "rate_limited"));
    expect((await book(780)).status).toBe(201);
    const hang = { ...sinks, message: () => new Promise<never>(() => {}) };
    const at = CLOCK + 3_600_000;
    const report = await deliverDue({
      db: db as unknown as PrismaClient, clock: async () => at, sinks: hang, simulatedSinks: SIMULATED_SINKS,
      leaseMs: 1_000, maxAttempts: EFFECT_MAX_ATTEMPTS, sinkTimeoutMs: 50, tenants: [tenantId],
    }, 10);
    expect(report).toEqual({ delivered: 0, retried: 1, failed: 0 });
    expect(await emailEffects()).toEqual([{ status: "pending", attempts: 2 }]);
    // Not claimable again until after the sink timeout plus its margin, whatever the lease setting.
    const [{ due }] = await db.$queryRaw<Array<{ due: number }>>`
      SELECT (extract(epoch FROM next_attempt_at) * 1000)::float8 AS due FROM tenant_effect WHERE tenant_id = ${tenantId} AND payload->>'port' = 'email' ORDER BY seq DESC LIMIT 1`;
    expect(due).toBeGreaterThanOrEqual(at + 5_050);
  });

  it("keeps the plain lease and backoff for other effects after a timeout, so a refund is not delayed", async () => {
    const id = `payment-${run}`;
    await db.$executeRaw`
      INSERT INTO tenant_effect (tenant_id, seq, n, id, fingerprint, kind, payload, next_attempt_at)
      VALUES (${tenantId}, 9000001, 0, ${id}, 'fingerprint', 'payment', ${JSON.stringify({ id: "o-pay", port: "payments", action: "checkout", body: "Fictional deposit", cost: null })}::jsonb, to_timestamp(0))`;
    const at = CLOCK + 3_600_000;
    const hang = { ...sinks, payment: () => new Promise<never>(() => {}) };
    const report = await deliverDue({
      db: db as unknown as PrismaClient, clock: async () => at, sinks: hang, simulatedSinks: SIMULATED_SINKS,
      leaseMs: 1_000, maxAttempts: EFFECT_MAX_ATTEMPTS, sinkTimeoutMs: 50, tenants: [tenantId],
    }, 10);
    expect(report).toEqual({ delivered: 0, retried: 1, failed: 0 });
    const [row] = await db.$queryRaw<Array<{ due: number; leased: boolean }>>`
      SELECT (extract(epoch FROM next_attempt_at) * 1000)::float8 AS due, leased_until IS NOT NULL AS leased FROM tenant_effect WHERE id = ${id}`;
    // The first backoff (2 s), not the message's wait for its lease: nothing is held.
    expect(row.leased).toBe(false);
    expect(row.due).toBeGreaterThanOrEqual(at + 2_000);
    expect(row.due).toBeLessThan(at + 5_000);
    await db.$executeRaw`DELETE FROM tenant_effect WHERE id = ${id}`;
  });

  it("gives a send near the end of the drain budget only what is left of it", async () => {
    outcome = fail(connectionError("email", "resend", "rate_limited"));
    expect((await book(540, randomUUID(), undefined, "2026-11-25")).status).toBe(201);
    const hang = { ...sinks, message: () => new Promise<never>(() => {}) };
    const began = performance.now();
    const report = await deliverDue({
      db: db as unknown as PrismaClient, clock: async () => CLOCK + 10 * 3_600_000, sinks: hang, simulatedSinks: SIMULATED_SINKS,
      leaseMs: EFFECT_LEASE_MS, maxAttempts: EFFECT_MAX_ATTEMPTS, sinkTimeoutMs: 10_000, budgetMs: 300, tenants: [tenantId],
    }, 10);
    expect(report).toEqual({ delivered: 0, retried: 1, failed: 0 });
    expect(performance.now() - began).toBeLessThan(3_000);
  });

  it("holds a public booking's e-mail without using an attempt while public booking is off", async () => {
    outcome = fail(connectionError("email", "resend", "rate_limited"));
    expect((await book(840)).status).toBe(201);
    expect(await emailEffects()).toEqual([{ status: "pending", attempts: 1 }]);
    outcome = ok({ id: "m-3", to: [] }, "sent");
    const sentBefore = mails.length;
    vi.stubEnv("PUBLIC_BOOKING_LIVE", "");
    expect(await drain(CLOCK + 3_600_000)).toEqual({ delivered: 0, retried: 1, failed: 0 });
    expect(mails).toHaveLength(sentBefore);
    // The claim is counted (a claim's number is never reused) but not spent: it goes to the attempt base.
    expect(await emailEffects()).toEqual([{ status: "pending", attempts: 2 }]);
    expect((await delivery())[0].delivery).toMatchObject({ attemptBase: 1 });
    vi.stubEnv("PUBLIC_BOOKING_LIVE", "1");
    expect(await drain(CLOCK + 2 * 3_600_000)).toEqual({ delivered: 1, retried: 0, failed: 0 });
    expect(await emailEffects()).toEqual([{ status: "delivered", attempts: 3 }]);
  });

  it("stops claiming when the drain's time budget is spent, leaving the rest for the poller", async () => {
    outcome = fail(connectionError("email", "resend", "rate_limited"));
    expect((await book(900)).status).toBe(201);
    const report = await deliverDue({
      db: db as unknown as PrismaClient, clock: async () => CLOCK + 10 * 3_600_000, sinks, simulatedSinks: SIMULATED_SINKS,
      leaseMs: EFFECT_LEASE_MS, maxAttempts: EFFECT_MAX_ATTEMPTS, budgetMs: 0, tenants: [tenantId],
    }, 10);
    expect(report).toEqual({ delivered: 0, retried: 0, failed: 0 });
    expect(await emailEffects()).toEqual([{ status: "pending", attempts: 1 }]);
  });

  it("drops the frozen message when the customer is erased, and cancels the pending send", async () => {
    outcome = fail(connectionError("email", "resend", "rate_limited"));
    expect((await book(960, randomUUID(), "0735551888")).status).toBe(201);
    expect((await delivery())[0].delivery).toMatchObject({ mail: expect.anything() });
    const { state } = (await holder.store.load(tenantId))!;
    const customer = state.customers.find((c) => c.phone.replace(/\D/g, "").endsWith("735551888"))!;
    expect(await holder.store.eraseSubject(tenantId, customer.id)).toMatchObject({ ok: true });
    expect((await delivery())[0].delivery).toBeNull();
    expect(await emailEffects()).toEqual([{ status: "cancelled", attempts: 1 }]);
  });
});

describe("live or simulated, decided when the effect is staged", () => {
  const staged = () => db.$queryRaw<Array<{ live: boolean | null; status: string }>>`
    SELECT (payload->>'live')::boolean AS live, status FROM tenant_effect WHERE tenant_id = ${tenantId} AND payload->>'port' = 'email' ORDER BY seq DESC LIMIT 1`;

  it("stages a live row from the deployment's configuration, and a simulated row stays simulated on a worker that could send", async () => {
    expect((await book(600, randomUUID(), "0735551711", "2026-11-27")).status).toBe(201);
    expect(await staged()).toEqual([{ live: true, status: "delivered" }]);
    const before = mails.length;
    vi.stubEnv("CONCEPT_CONNECTIONS_LIVE", "");
    expect((await book(660, randomUUID(), "0735551712", "2026-11-27")).status).toBe(201);
    vi.stubEnv("CONCEPT_CONNECTIONS_LIVE", "1");
    // The worker that delivered it resolves to a live adapter, but the row was staged without live connections: nothing went out.
    expect(await staged()).toEqual([{ live: false, status: "delivered" }]);
    expect(mails).toHaveLength(before);
  });
});

describe("a delivery racing an erasure or another claim", () => {
  const realSink = messageSink(db as unknown as PrismaClient, registry);
  const emailId = async () => (await db.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM tenant_effect WHERE tenant_id = ${tenantId} AND payload->>'port' = 'email' ORDER BY seq DESC LIMIT 1`)[0].id;
  const drainWith = (message: EffectSink, at = CLOCK + 3_600_000) => deliverDue({
    db: db as unknown as PrismaClient, clock: async () => at, sinks: { ...SIMULATED_SINKS, message }, simulatedSinks: SIMULATED_SINKS,
    leaseMs: EFFECT_LEASE_MS, maxAttempts: EFFECT_MAX_ATTEMPTS, tenants: [tenantId],
  }, 10);
  /** A booking whose e-mail the first attempt left pending, frozen. */
  const pendingBooking = async (start: number, phone: string) => {
    outcome = fail(connectionError("email", "resend", "rate_limited"));
    expect((await book(start, randomUUID(), phone, "2026-11-26")).status).toBe(201);
    outcome = ok({ id: "m-race", to: [] }, "sent");
    return mails.length;
  };

  it("sends nothing for a claim that another deliverer replaced, and the right claim still sends once", async () => {
    const before = await pendingBooking(540, "0735551701");
    const id = await emailId();
    const stale: EffectSink = async (delivery, signal) => {
      await db.$executeRaw`UPDATE tenant_effect SET attempts = attempts + 1 WHERE id = ${id}`;
      return realSink(delivery, signal);
    };
    expect(await drainWith(stale)).toEqual({ delivered: 0, retried: 1, failed: 0 });
    expect(mails).toHaveLength(before);
    expect((await delivery())[0].delivery).not.toHaveProperty("dispatched");
    expect(await drain(CLOCK + 2 * 3_600_000)).toEqual({ delivered: 1, retried: 0, failed: 0 });
    expect(mails).toHaveLength(before + 1);
  });

  it("sends nothing when an erasure cancels the effect between the claim and the dispatch", async () => {
    const before = await pendingBooking(600, "0735551702");
    const id = await emailId();
    const erased: EffectSink = async (delivery, signal) => {
      await db.$executeRaw`UPDATE tenant_effect SET status = 'cancelled', erased_at = now() WHERE id = ${id}`;
      return realSink(delivery, signal);
    };
    await drainWith(erased);
    expect(mails).toHaveLength(before);
    expect(await emailEffects()).toEqual([{ status: "cancelled", attempts: 2 }]);
  });

  it("leaves a cancelled row cancelled when the customer was erased between the claim and the sink's read", async () => {
    const before = await pendingBooking(780, "0735551705");
    const { state } = (await holder.store.load(tenantId))!;
    const customer = state.customers.find((c) => c.phone.replace(/\D/g, "").endsWith("735551705"))!;
    const erasing: EffectSink = async (delivery, signal) => {
      await holder.store.eraseSubject(tenantId, customer.id);
      return realSink(delivery, signal);
    };
    expect(await drainWith(erasing)).toEqual({ delivered: 0, retried: 0, failed: 0, skipped: 1 });
    expect(mails).toHaveLength(before);
    expect(await emailEffects()).toEqual([{ status: "cancelled", attempts: 2 }]);
  });

  it("sends nothing when an erasure holding the tenant's lock clears the address first", async () => {
    const before = await pendingBooking(660, "0735551703");
    const [{ doc }] = await db.$queryRaw<Array<{ doc: unknown }>>`SELECT doc FROM tenant_state WHERE tenant_id = ${tenantId}`;
    let draining!: ReturnType<typeof drain>;
    const erasing = createDatabaseClient(process.env.DATABASE_URL, 2) as PrismaClient;
    await erasing.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM tenant_state WHERE tenant_id = ${tenantId} FOR UPDATE`;
      draining = drain(CLOCK + 2 * 3_600_000);
      // The sink reads, freezes and then waits for the lock, the one an erasure holds until it commits.
      for (let waited = 0; waited < 50; waited++) {
        // Not through `tx`: a transaction sees the activity view as it was at its first look.
        const [{ n }] = await db.$queryRaw<Array<{ n: number }>>`
          SELECT count(*)::int AS n FROM pg_stat_activity WHERE wait_event_type = 'Lock' AND query LIKE '%FOR SHARE%'`;
        if (n) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      await tx.$executeRaw`
        UPDATE tenant_state SET doc = jsonb_set(doc, '{bookings}', (SELECT jsonb_agg(b - 'contactEmail') FROM jsonb_array_elements(doc->'bookings') b))
        WHERE tenant_id = ${tenantId}`;
    });
    await erasing.$disconnect();
    await draining;
    expect(mails).toHaveLength(before);
    expect((await delivery())[0].delivery).not.toHaveProperty("dispatched");
    await db.$executeRaw`UPDATE tenant_state SET doc = ${JSON.stringify(doc)}::jsonb WHERE tenant_id = ${tenantId}`;
  });

  it("lets an erasure that comes after the dispatch finish, reports the send in flight and records it delivered", async () => {
    const before = await pendingBooking(720, "0735551704");
    const { state } = (await holder.store.load(tenantId))!;
    const customer = state.customers.find((c) => c.phone.replace(/\D/g, "").endsWith("735551704"))!;
    let release!: () => void;
    providerGate = new Promise<void>((resolve) => { release = resolve; });
    const called = new Promise<void>((resolve) => { providerCalled = resolve; });
    const draining = drain(CLOCK + 2 * 3_600_000);
    await called;
    // The marker was committed before the provider was called.
    expect((await delivery())[0].delivery).toMatchObject({ dispatched: true });
    expect(await holder.store.eraseSubject(tenantId, customer.id)).toMatchObject({ ok: true, inFlightMessages: 1 });
    release();
    expect(await draining).toEqual({ delivered: 1, retried: 0, failed: 0 });
    expect(mails).toHaveLength(before + 1);
    expect(await emailEffects()).toEqual([{ status: "delivered", attempts: 2 }]);
    expect((await delivery())[0].delivery).not.toHaveProperty("mail");
  });
});
