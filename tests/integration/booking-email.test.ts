import { randomBytes, randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../../src/app/api/public/salons/[slug]/bookings/route";
import { POST as VIEW } from "../../src/app/api/public/salons/[slug]/bookings/[id]/route";
import { addressProof } from "../../scripts/client-address.mjs";
import { acceptedTerms, type AcceptedTerms } from "../../src/concept/booking/public-terms";
import { connectionError, fail, ok, type PortResult } from "../../src/concept/connections/core";
import type { EmailMessage, EmailPort, EmailReceipt } from "../../src/concept/connections/ports/email";
import { deliverDue, drainPendingEffects, EFFECT_LEASE_MS, EFFECT_MAX_ATTEMPTS, SIMULATED_SINKS } from "../../src/concept/store/effect-outbox";
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
const registry = { resolve: async () => ({ adapter: { send: async (m: EmailMessage) => (mails.push(m), outcome) } as unknown as EmailPort, live: true, reason: "live" as const }) };
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
  mails.length = 0;
  outcome = ok({ id: "m-1", to: [] }, "sent");
});

afterAll(async () => {
  await db.ownerAccount.deleteMany({ where: { email: { endsWith: `-${run}@example.test` } } });
  for (const table of ["tenant_effect", "tenant_idempotency", "tenant_action", "tenant_state"])
    await db.$executeRawUnsafe(`DELETE FROM ${table} WHERE tenant_id = $1`, tenantId);
  vi.unstubAllEnvs();
  await db.$disconnect();
});

function book(start: number, key: string = randomUUID(), phone = `0735551${100 + ++calls}`) {
  const ip = `10.8.${Math.floor(++calls / 250)}.${calls % 250}`;
  const body = {
    serviceId, staffId, date: DATE, start, name: "Lisa Berg", phone, email: "lisa@example.test", language: "en", website: "",
    terms, issuedAt: issuedAtToken(tenantId, slug, Date.now() - 10_000),
  };
  return POST(new NextRequest(`http://localhost/api/public/salons/${slug}/bookings`, {
    method: "POST", body: JSON.stringify(body),
    headers: { "content-type": "application/json", host: "localhost", origin: "http://localhost", "idempotency-key": key, "x-booking-client-ip": ip, "x-booking-client-proof": addressProof(ip, SECRET) },
  }), { params: Promise.resolve({ slug }) });
}

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
    const view = await VIEW(new NextRequest(`http://localhost/api/public/salons/${slug}/bookings/${ref}`, {
      method: "POST", body: JSON.stringify({ token }),
      headers: { "content-type": "application/json", host: "localhost", origin: "http://localhost", "x-booking-client-ip": "10.8.99.1", "x-booking-client-proof": addressProof("10.8.99.1", SECRET) },
    }), { params: Promise.resolve({ slug, id: ref }) });
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
    expect(await drain(CLOCK)).toEqual({ delivered: 0, retried: 0, failed: 0 });

    outcome = ok({ id: "m-2", to: [] }, "sent");
    expect(await drain(CLOCK + 3_600_000)).toEqual({ delivered: 1, retried: 0, failed: 0 });
    expect(mails).toHaveLength(2);
    expect(mails[1].idempotencyKey).toBe(mails[0].idempotencyKey);
    expect(await emailEffects()).toEqual([{ status: "delivered", attempts: 2 }]);
  });

  it("counts a sink that outlasts its timeout as a retry", async () => {
    outcome = fail(connectionError("email", "resend", "timeout"));
    expect((await book(780)).status).toBe(201);
    const hang = { ...sinks, message: () => new Promise<never>(() => {}) };
    const report = await deliverDue({
      db: db as unknown as PrismaClient, clock: async () => CLOCK + 3_600_000, sinks: hang, simulatedSinks: SIMULATED_SINKS,
      leaseMs: EFFECT_LEASE_MS, maxAttempts: EFFECT_MAX_ATTEMPTS, sinkTimeoutMs: 50, tenants: [tenantId],
    }, 10);
    expect(report).toEqual({ delivered: 0, retried: 1, failed: 0 });
    expect(await emailEffects()).toEqual([{ status: "pending", attempts: 2 }]);
  });
});
