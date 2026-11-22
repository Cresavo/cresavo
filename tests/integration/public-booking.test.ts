import { randomBytes, randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { POST } from "../../src/app/api/public/salons/[slug]/bookings/route";
import { GET } from "../../src/app/api/public/salons/[slug]/route";
import { addressProof } from "../../scripts/client-address.mjs";
import { db } from "../../src/lib/db";
import { createOwnerAccount } from "../../src/lib/owner-accounts";
import { issuedAtToken } from "../../src/lib/public-issued-at";
import { GUARD_PREFIXES } from "../../src/lib/owner-guard-keys";
import { rateLimitDatabase, reserveRateLimit } from "../../src/lib/postgres-rate-limit";
import { reserveTenantQuota } from "../../src/lib/rate-limit";
import type { DemoAction } from "../../src/concept/actions";
import { acceptedTerms, type AcceptedTerms } from "../../src/concept/booking/public-terms";
import { SIMULATED_SINKS } from "../../src/concept/store/effect-outbox";
import { PostgresStudioStore } from "../../src/concept/store/postgres-studio-store";

// The public booking write against a disposable local *_test database: one
// slot is booked once however many ask at once, a key replays, and a key
// reused for another request is refused. The store's clock is fixed so the
// dates are too. All data is fictional.

const run = randomUUID().slice(0, 8);
const SECRET = "synthetic-address-secret";
const CLOCK = new Date("2026-11-16T10:00:00+01:00").getTime();
const DATE = "2026-11-24";

const holder = vi.hoisted(() => ({ store: undefined as unknown as import("../../src/concept/store/postgres-studio-store").PostgresStudioStore }));
vi.mock("../../src/lib/owner-store", async (importOriginal) => ({ ...(await importOriginal<object>()), ownerStore: () => holder.store }));

let tenantId = "";
let slug = "";
let serviceId = "";
let staffId = "";
let terms!: AcceptedTerms;
const extraTenants: string[] = [];
let calls = 0;

beforeAll(async () => {
  vi.stubEnv("OWNER_ACCOUNTS_ENABLED", "1");
  vi.stubEnv("PUBLIC_BOOKING_LIVE", "1");
  vi.stubEnv("SESSION_SECRET", randomBytes(32).toString("hex"));
  vi.stubEnv("BOOKING_ADDRESS_SECRET", SECRET);
  holder.store = new PostgresStudioStore({ prisma: db as unknown as PrismaClient, hmacSecret: randomBytes(32).toString("hex"), sinks: SIMULATED_SINKS, now: async () => CLOCK });
  const account = await createOwnerAccount({ email: `${randomUUID().slice(0, 8)}-${run}@example.test`, password: "a long fictional passphrase", salonName: `Salong Bokning ${run}`, language: "en" });
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

afterAll(async () => {
  await db.ownerAccount.deleteMany({ where: { email: { endsWith: `-${run}@example.test` } } });
  for (const table of ["tenant_effect", "tenant_idempotency", "tenant_action", "tenant_state"])
    await db.$executeRawUnsafe(`DELETE FROM ${table} WHERE tenant_id = ANY($1)`, [tenantId, ...extraTenants]);
  vi.unstubAllEnvs();
  await db.$disconnect();
});

/** A request from a fresh address (the limit is per address) and a fresh number (the cap is per number), 10 seconds after its page was served. */
function book(over: Record<string, unknown> = {}, key: string = randomUUID(), address = slug, tenant = tenantId) {
  const ip = `10.7.${Math.floor(++calls / 250)}.${calls % 250}`;
  const body = {
    serviceId, staffId, date: DATE, start: 600, name: "Lisa Berg", phone: `0735550${100 + (calls % 800)}`, email: "lisa@example.test", language: "en", website: "", terms,
    issuedAt: issuedAtToken(tenant, address, Date.now() - 10_000), ...over,
  };
  return POST(new NextRequest(`http://localhost/api/public/salons/${address}/bookings`, {
    method: "POST", body: JSON.stringify(body),
    headers: { "content-type": "application/json", host: "localhost", origin: "http://localhost", "idempotency-key": key, "x-booking-client-ip": ip, "x-booking-client-proof": addressProof(ip, SECRET) },
  }), { params: Promise.resolve({ slug: address }) });
}

const onlineAt = async (start: number) =>
  (await holder.store.load(tenantId))!.state.bookings.filter((b) => b.source === "online" && b.date === DATE && b.start === start);

describe("POST /api/public/salons/[slug]/bookings", () => {
  it("books one slot once when 20 guests ask for it at the same moment", async () => {
    const responses = await Promise.all(Array.from({ length: 20 }, (_, i) => book({ start: 540, name: `Guest Number${i}` })));
    const statuses = responses.map((r) => r.status);
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    // The others lose the slot, or are told to retry while the salon's row is locked; none books.
    expect(statuses.filter((s) => s !== 201).every((s) => s === 409 || s === 503)).toBe(true);
    const winner = await responses[statuses.indexOf(201)].json();
    const stored = await onlineAt(540);
    expect(stored).toHaveLength(1);
    expect(stored[0].publicRef).toBe(winner.ref);
    expect(winner).not.toHaveProperty("bookingId");
    expect(stored[0].contactEmail).toBe("lisa@example.test");
  });

  it("answers the same key twice with the same booking, and books once", async () => {
    const key = randomUUID();
    const same = { start: 660, phone: "0735550901" };
    const first = await book(same, key);
    const second = await book(same, key);
    expect([first.status, second.status]).toEqual([201, 201]);
    const [a, b] = [await first.json(), await second.json()];
    expect(b).toEqual(a);
    expect(await onlineAt(660)).toHaveLength(1);
  });

  it("refuses the same key for a different request, and books nothing", async () => {
    const key = randomUUID();
    expect((await book({ start: 720, phone: "0735550902" }, key)).status).toBe(201);
    const other = await book({ start: 780, phone: "0735550902" }, key);
    expect(other.status).toBe(422);
    expect(await other.json()).toEqual({ error: "idempotency_mismatch" });
    expect(await onlineAt(780)).toHaveLength(0);
  });

  it("answers a retry with the original receipt after the salon renamed the treatment and changed its price", async () => {
    const added = await holder.store.apply(tenantId, {
      type: "service/add",
      service: { name: "Fictional massage", category: (await holder.store.load(tenantId))!.state.categories[0].id, duration: 30, price: 400, description: "Fictional", staffIds: [staffId as never] },
    });
    if (!added.ok) throw new Error("service not added");
    const second = added.state.services.at(-1)!;
    const accepted = acceptedTerms(added.state, second);
    const request = { serviceId: second.id, start: 840, phone: "0735550903", terms: accepted };
    const key = randomUUID();
    const first = await book(request, key);
    expect(first.status).toBe(201);
    const receipt = await first.json();
    expect((await holder.store.apply(tenantId, { type: "service/update", id: second.id, service: { name: "Fictional massage, renamed", category: second.category, duration: 30, price: 400, description: "Fictional", staffIds: [staffId as never] } })).ok).toBe(true);
    expect((await holder.store.apply(tenantId, { type: "service/price", id: second.id, price: 550 })).ok).toBe(true);
    const replay = await book(request, key);
    expect(replay.status).toBe(201);
    expect(await replay.json()).toEqual(receipt);
    expect(await onlineAt(840)).toHaveLength(1);
    // A different guest who still has the old quote is told the terms moved, and books nothing.
    const stale = await book({ ...request, phone: "0735550904", start: 900 });
    expect([stale.status, await stale.json()]).toEqual([409, { error: "terms_changed" }]);
    expect(await onlineAt(900)).toHaveLength(0);
  });

  it("does not send a form to another salon that has taken over its address", async () => {
    const read = await GET(new NextRequest(`http://localhost/api/public/salons/${slug}`, { headers: { "x-booking-client-ip": "10.8.0.1", "x-booking-client-proof": addressProof("10.8.0.1", SECRET) } }), { params: Promise.resolve({ slug }) });
    const { issuedAt } = await read.json();
    const oldAddress = slug;
    expect((await holder.store.apply(tenantId, { type: "salon/slug", slug: `${oldAddress}-ny` })).ok).toBe(true);
    const other = await createOwnerAccount({ email: `${randomUUID().slice(0, 8)}-${run}@example.test`, password: "a long fictional passphrase", salonName: `Salong Ovan ${run}`, language: "en" });
    if (!other.ok) throw new Error("sign-up failed");
    extraTenants.push(other.tenantId);
    expect((await holder.store.apply(other.tenantId, { type: "salon/slug", slug: oldAddress })).ok).toBe(true);
    const response = await book({ issuedAt, start: 960 }, randomUUID(), oldAddress);
    expect([response.status, await response.json()]).toEqual([422, { error: "invalid" }]);
    expect(await onlineAt(960)).toHaveLength(0);
  });
});

// The salon's allowance (60 an hour) and its account flag are judged inside the store's transaction (#133 items 6, 7 and 9).
describe("the salon's allowance and account flag, under the store's lock", () => {
  type Salon = { tenantId: string; slug: string; serviceId: string; staffId: string; terms: AcceptedTerms };
  const own = (salon: Salon, over: Record<string, unknown> = {}) => ({ serviceId: salon.serviceId, staffId: salon.staffId, terms: salon.terms, ...over });
  const bookIn = (salon: Salon, over: Record<string, unknown> = {}, key: string = randomUUID()) => book(own(salon, over), key, salon.slug, salon.tenantId);

  async function newSalon(): Promise<Salon> {
    const account = await createOwnerAccount({ email: `${randomUUID().slice(0, 8)}-${run}@example.test`, password: "a long fictional passphrase", salonName: `Salong Kvot ${randomUUID().slice(0, 6)}`, language: "en" });
    if (!account.ok) throw new Error("sign-up failed");
    extraTenants.push(account.tenantId);
    const { state } = (await holder.store.load(account.tenantId))!;
    const added = await holder.store.apply(account.tenantId, {
      type: "service/add",
      service: { name: "Fictional foot care", category: state.categories[0].id, duration: 60, price: 500, description: "Fictional", staffIds: [state.staff[0].id] },
    });
    if (!added.ok) throw new Error("service not added");
    return { tenantId: account.tenantId, slug: state.salon.slug, serviceId: added.state.services[0].id, staffId: state.staff[0].id, terms: acceptedTerms(added.state, added.state.services[0]) };
  }

  beforeAll(() => { vi.stubEnv("RATE_LIMIT_STORE", "postgres"); });
  afterAll(async () => { vi.unstubAllEnvs(); await rateLimitDatabase.$disconnect(); });

  const guest = (salon: Salon, start: number): DemoAction => ({
    type: "online/book", guest: { name: "Lisa Berg", phone: "0735550777", email: "lisa@example.test", at: { date: "1970-01-01", time: 0 } },
    serviceId: salon.serviceId, staffId: salon.staffId as never, date: DATE, start, public: { slug: salon.slug, terms: salon.terms, publicRef: randomUUID() },
  });

  it("gives the allowance back when the commit fails after it was taken", async () => {
    const salon = await newSalon();
    // 60 attempts that take the allowance and then fail would use it all up if the allowance lived outside the transaction.
    for (let i = 0; i < 60; i++) {
      await expect(holder.store.apply(salon.tenantId, guest(salon, 540), { actor: "customer", source: "customer-page" }, {
        beforeCommit: async (tx) => { await reserveTenantQuota(salon.tenantId, tx); throw new Error("COMMIT_FAILED"); },
      })).rejects.toThrow("COMMIT_FAILED");
    }
    expect((await bookIn(salon, { start: 540 })).status).toBe(201);
  });

  it("counts each committed booking, and stops at 60 with a 429", async () => {
    const salon = await newSalon();
    for (let i = 0; i < 59; i++) await reserveRateLimit("public-tenant", salon.tenantId);
    expect((await bookIn(salon, { start: 540 })).status).toBe(201);
    const refused = await bookIn(salon, { start: 600 });
    expect(refused.status).toBe(429);
    expect(await onlineAtOf(salon.tenantId, 600)).toHaveLength(0);
  });

  it("replays a booking whose key the store knows even when the salon's allowance is used up", async () => {
    const salon = await newSalon();
    const key = randomUUID();
    const same = { start: 540, phone: "0735550888" };
    const first = await bookIn(salon, same, key);
    expect(first.status).toBe(201);
    for (let i = 0; i < 59; i++) await reserveRateLimit("public-tenant", salon.tenantId);
    expect((await bookIn(salon, { start: 600 })).status).toBe(429);
    const retry = await bookIn(salon, same, key);
    expect([retry.status, await retry.json()]).toEqual([201, await first.clone().json()]);
  });

  it("refuses a write to an account that was switched off after the lookup, a replay included", async () => {
    const salon = await newSalon();
    const key = `booking-page:${randomUUID()}`;
    const action = guest(salon, 540);
    const meta = { actor: "customer" as const, source: "customer-page" as const };
    expect((await holder.store.apply(salon.tenantId, action, meta, { idempotencyKey: key, requireActiveAccount: true })).ok).toBe(true);
    await db.ownerAccount.updateMany({ where: { tenantId: salon.tenantId }, data: { active: false } });
    expect(await holder.store.apply(salon.tenantId, guest(salon, 600), meta, { requireActiveAccount: true })).toEqual({ ok: false, reason: "not-found" });
    expect(await holder.store.apply(salon.tenantId, action, meta, { idempotencyKey: key, requireActiveAccount: true })).toEqual({ ok: false, reason: "not-found" });
    expect(await onlineAtOf(salon.tenantId, 600)).toHaveLength(0);
    // The owner's own changes are not public writes and still go through.
    expect((await holder.store.apply(salon.tenantId, { type: "card/dismiss", id: "owner-still-writes" })).ok).toBe(true);
  });

  it("makes switching the account off wait for a booking that already checked it", async () => {
    const salon = await newSalon();
    let checked!: () => void;
    const reached = new Promise<void>((resolve) => { checked = resolve; });
    let proceed!: () => void;
    const hold = new Promise<void>((resolve) => { proceed = resolve; });
    const booking = holder.store.apply(salon.tenantId, guest(salon, 540), { actor: "customer", source: "customer-page" }, {
      requireActiveAccount: true, beforeCommit: async () => { checked(); await hold; },
    });
    await reached;
    let switchedOff = false;
    const off = db.ownerAccount.updateMany({ where: { tenantId: salon.tenantId }, data: { active: false } }).then(() => { switchedOff = true; });
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(switchedOff).toBe(false);
    proceed();
    expect((await booking).ok).toBe(true);
    await off;
    expect(switchedOff).toBe(true);
  });

  it("keeps the shared rate store within its 10,000 buckets when a salon's first reservation commits", async () => {
    const salon = await newSalon();
    const marker = `capacity-${run}`;
    // Owner sign-in guard rows have their own cap and are outside this one, so only ordinary buckets count.
    const ordinary = { NOT: GUARD_PREFIXES.map((prefix) => ({ key: { startsWith: prefix } })) };
    const missing = 10000 - (await db.rateLimitBucket.count({ where: ordinary }));
    await db.$executeRawUnsafe(`INSERT INTO "RateLimitBucket" ("key", "generation", "count", "expiresAt")
      SELECT '${marker}-' || g, 'g', 1, now() + interval '2 hours' FROM generate_series(1, ${Math.max(0, missing)}) g`);
    try {
      expect(await db.rateLimitBucket.count({ where: ordinary })).toBeGreaterThanOrEqual(10000);
      expect((await bookIn(salon, { start: 540 })).status).toBe(201);
      expect(await db.rateLimitBucket.count({ where: ordinary })).toBeLessThanOrEqual(10000);
    } finally {
      await db.$executeRawUnsafe(`DELETE FROM "RateLimitBucket" WHERE "key" LIKE '${marker}-%'`);
    }
  });
});

const onlineAtOf = async (tenant: string, start: number) =>
  (await holder.store.load(tenant))!.state.bookings.filter((b) => b.source === "online" && b.date === DATE && b.start === start);
