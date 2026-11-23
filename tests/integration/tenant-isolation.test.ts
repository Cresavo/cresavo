import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import type { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { GET as getMe } from "../../src/app/api/owner/me/route";
import { POST as logout } from "../../src/app/api/owner/logout/route";
import { POST as logoutAll } from "../../src/app/api/owner/logout-all/route";
import { POST as postAction } from "../../src/app/api/owner/salon/actions/route";
import { POST as postErase } from "../../src/app/api/owner/salon/erase/route";
import { GET as getSalon } from "../../src/app/api/owner/salon/route";
import { POST as book } from "../../src/app/api/public/salons/[slug]/bookings/route";
import { POST as view } from "../../src/app/api/public/salons/[slug]/bookings/[id]/route";
import { POST as cancel } from "../../src/app/api/public/salons/[slug]/bookings/[id]/cancel/route";
import { POST as move } from "../../src/app/api/public/salons/[slug]/bookings/[id]/move/route";
import { addressProof } from "../../scripts/client-address.mjs";
import { createDatabaseClient } from "../../scripts/database.mjs";
import type { DemoAction } from "../../src/concept/actions";
import { acceptedTerms } from "../../src/concept/booking/public-terms";
import { createDemoState } from "../../src/concept/data/generate";
import type { Booking, DemoState } from "../../src/concept/data/types";
import { drainPendingEffects, SIMULATED_SINKS, type EffectDelivery, type EffectSinks } from "../../src/concept/store/effect-outbox";
import { PostgresStudioStore, type TenantKind } from "../../src/concept/store/postgres-studio-store";
import { sweepActivityPersonalData, sweepDemoActions, sweepExpiredIdempotency, sweepExpiredSandboxes, sweepOutboxBodies } from "../../src/concept/store/store-sweepers";
import { bookingTokenExpiry, mintBookingToken } from "../../src/lib/booking-token";
import { db } from "../../src/lib/db";
import { createOwnerAccount } from "../../src/lib/owner-accounts";
import { openOwnerSession, OWNER_COOKIE } from "../../src/lib/owner-session";
import { issuedAtToken } from "../../src/lib/public-issued-at";
import { withOwnSlug } from "./own-slug";

// Tenant isolation against a disposable local *_test database: one owner, one
// customer or one stored row tries to read or change another salon's data.
// Every case has a control that shows the request works for its own salon, so
// a refusal is the tenant boundary and not a malformed request. The store's
// clock and Date are fixed so the dates are too. All data is fictional.
//
// What the other integration files already cover is listed in the report of
// the commit that added this one; nothing here repeats a case from them.

const run = randomUUID().slice(0, 8);
const SECRET = "synthetic-address-secret";
const CLOCK = new Date("2026-11-16T10:00:00+01:00").getTime();
const TODAY = "2026-11-16";
const DATE = "2026-11-24";
const origin = "http://localhost";
const PREFIX = `ti-${run}`;
const hmacSecret = randomBytes(32).toString("hex");
const fixedClock = async () => CLOCK;

const holder = vi.hoisted(() => ({ store: undefined as unknown as import("../../src/concept/store/postgres-studio-store").PostgresStudioStore }));
vi.mock("../../src/lib/owner-store", async (importOriginal) => ({ ...(await importOriginal<object>()), ownerStore: () => holder.store }));

const clients: PrismaClient[] = [];
const newClient = (url?: string) => { const client = createDatabaseClient(url, 5) as PrismaClient; clients.push(client); return client; };
const prisma = db as unknown as PrismaClient;
const store = () => holder.store;

beforeAll(() => {
  // The routes judge sessions, links and cutoffs by Date.now(); the store's clock is pinned to the same day.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(CLOCK);
  vi.stubEnv("OWNER_ACCOUNTS_ENABLED", "1");
  vi.stubEnv("PUBLIC_BOOKING_LIVE", "1");
  vi.stubEnv("SESSION_SECRET", randomBytes(32).toString("hex"));
  vi.stubEnv("BOOKING_ADDRESS_SECRET", SECRET);
  holder.store = new PostgresStudioStore({ prisma, hmacSecret, sinks: SIMULATED_SINKS, now: fixedClock });
});

afterAll(async () => {
  const accounts = await db.ownerAccount.findMany({ where: { email: { endsWith: `-${run}@example.test` } }, select: { tenantId: true } });
  await db.ownerAccount.deleteMany({ where: { email: { endsWith: `-${run}@example.test` } } });
  const owned = accounts.map((a) => a.tenantId);
  for (const table of ["tenant_effect", "tenant_idempotency", "tenant_action", "tenant_state"])
    await db.$executeRawUnsafe(`DELETE FROM ${table} WHERE tenant_id = ANY($1) OR tenant_id LIKE $2`, owned, `${PREFIX}%`);
  vi.useRealTimers();
  vi.unstubAllEnvs();
  await Promise.all([db.$disconnect(), ...clients.map((client) => client.$disconnect())]);
});

// ---------------------------------------------------------------------------
// Fixtures: owner accounts reached through the HTTP routes, tenants seeded straight into the store's tables.
// ---------------------------------------------------------------------------

interface Owner { tenantId: string; accountId: string; email: string; cookie: string; label: string }

async function owner(label: string): Promise<Owner> {
  const email = `${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${run}@example.test`;
  const result = await createOwnerAccount({ email, password: "a long fictional passphrase", salonName: `Salong ${label} ${run}`, language: "en" });
  if (!result.ok) throw new Error("sign-up failed");
  const session = await openOwnerSession(result.identity);
  return { tenantId: result.tenantId, accountId: result.identity.id, email, cookie: `${OWNER_COOKIE}=${session!.value}`, label };
}

/** Another session of the same account. */
async function reopen(accountId: string) {
  const { credentialVersion } = await db.ownerAccount.findUniqueOrThrow({ where: { id: accountId } });
  return openOwnerSession({ id: accountId, credentialVersion });
}

const ownerRequest = (path: string, init: { cookie?: string; body?: unknown; headers?: Record<string, string> } = {}) => new NextRequest(`${origin}${path}`, {
  method: init.body === undefined ? "GET" : "POST", body: init.body === undefined ? undefined : JSON.stringify(init.body),
  headers: { ...(init.cookie ? { cookie: init.cookie } : {}), ...(init.body === undefined ? {} : { origin, host: "localhost", "content-type": "application/json" }), ...init.headers },
});
const read = (cookie: string, path = "/api/owner/salon", headers: Record<string, string> = {}) => getSalon(ownerRequest(path, { cookie, headers }));
const send = (cookie: string, body: unknown, headers: Record<string, string> = {}, path = "/api/owner/salon/actions") =>
  postAction(ownerRequest(path, { cookie, body, headers }));
const erase = (cookie: string, body: unknown) => postErase(ownerRequest("/api/owner/salon/erase", { cookie, body }));
let keys = 0;
const act = (cookie: string, action: unknown, extra: Record<string, unknown> = {}) => send(cookie, { action, idempotencyKey: `iso-${run}-${++keys}`, ...extra });
const stateOf = async (tenantId: string) => (await store().load(tenantId))!;

let phones = 0;
const customerRow = (label: string, n: number, staff: string) => ({
  firstName: `${label}${n}`, lastName: "Testsson", phone: `0700${String(2000 + ++phones)}`, email: `${label.toLowerCase()}${n}-${run}@customers.example.test`,
  category: "both", since: "2025-01-10", isRegular: false, tags: ["Imported"], waitlist: false, preferredStaff: staff,
});

/** Every id of every record the studio can name, for the attacker to try against another salon. */
interface Ids {
  staff: string; category: string; services: string[]; customers: string[]; bookings: string[]; publicRef: string;
  inbox: string; trash: string; log: string; email: string; phone: string; name: string;
}

/**
 * A salon with four treatments, five customers, four bookings (one is a public one with a reference), an inbox note, a customer in the trash and a log.
 * The studio numbers its records from a counter of its own (`svc-1`, `k-9`, `i-29`), so two salons built the same way hold the same ids. `pad` first
 * adds that many treatments, which moves the counter on: the ids of a padded salon exist in no unpadded one.
 */
async function populate(label: string, pad = 0): Promise<Owner & { ids: Ids }> {
  const who = await owner(label);
  const first = (await (await read(who.cookie)).json()).state as DemoState;
  const staff = first.staff[0].id;
  const category = first.categories[0].id;
  for (let n = 1; n <= pad; n++) {
    const filler = { name: `${label} filler ${n}`, duration: 15, price: 100, category, description: "Fictional", staffIds: [staff] };
    expect((await act(who.cookie, { type: "service/add", service: filler })).status).toBe(200);
  }
  for (let n = 1; n <= 4; n++) {
    const service = { name: `${label} behandling ${n}`, duration: 60, price: 500 + n, category, description: "Fictional", staffIds: [staff] };
    expect((await act(who.cookie, { type: "service/add", service })).status).toBe(200);
  }
  const rows = [1, 2, 3, 4, 5].map((n) => customerRow(label, n, staff));
  expect((await act(who.cookie, { type: "customers/import", customers: rows })).status).toBe(200);
  const { state } = await stateOf(who.tenantId);
  const customers = rows.map((row) => state.customers.find((c) => c.email === row.email)!.id);
  const services = state.services.filter((s) => s.name.startsWith(`${label} behandling`)).map((s) => s.id);
  const bookings = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
  for (const [i, id] of bookings.entries()) {
    const booked = await act(who.cookie, { type: "booking/create", id, serviceId: services[0], staffId: staff, date: DATE, start: 540 + 60 * i, source: "phone", customerId: customers[i] });
    expect(booked.status, `booking ${i}`).toBe(200);
  }
  expect((await act(who.cookie, { type: "customer/delete", id: customers[4] })).status).toBe(200);
  const notice = { kind: "message", fromName: "Fictional Sender", date: TODAY, time: 600, title: `Fictional note ${label}`, body: "Fictional", read: false, handled: false };
  const noted = await (await act(who.cookie, { type: "inbox/add", item: notice })).json();
  const after = noted.state as DemoState;
  const publicRef = randomUUID();
  const terms = acceptedTerms(after, after.services.find((s) => s.id === services[1])!);
  const guest = { name: `Guest ${label}`, phone: `0735${String(550000 + ++phones)}`, email: `guest-${label.toLowerCase()}-${run}@customers.example.test`, at: { date: "1970-01-01", time: 0 } };
  const online = await store().apply(who.tenantId, {
    type: "online/book", guest, serviceId: services[1], staffId: staff as never, date: DATE, start: 960, public: { slug: after.salon.slug, terms, publicRef },
  } as DemoAction, { actor: "customer", source: "customer-page" });
  if (!online.ok) throw new Error(`online booking refused: ${online.reason}`);
  const finalState = online.state;
  return {
    ...who,
    ids: {
      staff, category, services, customers, bookings, publicRef, inbox: finalState.inbox.find((i) => i.title === notice.title)!.id,
      trash: finalState.trash[0].id,
      log: finalState.log.find((entry) => entry.type === "service/add" && entry.summary.includes("behandling 4"))!.id,
      email: rows[0].email, phone: rows[0].phone, name: `${rows[0].firstName} ${rows[0].lastName}`,
    },
  };
}

type Table = "state" | "actions" | "keys" | "effects";
const SNAPSHOT: Record<Table, string> = {
  state: `SELECT version, kind::text AS kind, doc, expires_at FROM tenant_state WHERE tenant_id = $1`,
  actions: `SELECT seq::int AS seq, action, actor, source, at, idempotency_key, resulting_version, subject_ids, redacted_at FROM tenant_action WHERE tenant_id = $1 ORDER BY seq`,
  keys: `SELECT key, fingerprint_hmac, seq::int AS seq, result, expires_at FROM tenant_idempotency WHERE tenant_id = $1 ORDER BY key`,
  effects: `SELECT seq::int AS seq, n, id, fingerprint, kind, payload, status, attempts, next_attempt_at, delivered_at, leased_until, erased_at FROM tenant_effect WHERE tenant_id = $1 ORDER BY seq, n`,
};

/** Everything the four store tables hold for one tenant, so "unchanged" means every column of every row. */
async function snapshot(tenantId: string, client: PrismaClient = prisma): Promise<Record<Table, unknown[]>> {
  const out = {} as Record<Table, unknown[]>;
  for (const table of Object.keys(SNAPSHOT) as Table[]) out[table] = JSON.parse(JSON.stringify(await client.$queryRawUnsafe<unknown[]>(SNAPSHOT[table], tenantId))) as unknown[];
  return out;
}

const count = async (table: string, tenantId: string) =>
  Number((await db.$queryRawUnsafe<Array<{ n: bigint }>>(`SELECT count(*) AS n FROM ${table} WHERE tenant_id = $1`, tenantId))[0].n);

/** Every string and number value in a JSON body, joined: what a caller could read out of a response. */
const text = (value: unknown) => JSON.stringify(value);

/** Ids that B owns and A must not: no record id of B may exist in A's own document, or the attack would only hit A. */
const allIds = (value: unknown, into = new Set<string>()): Set<string> => {
  if (typeof value === "string") into.add(value);
  else if (Array.isArray(value)) value.forEach((item) => allIds(item, into));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => allIds(item, into));
  return into;
};

// ---------------------------------------------------------------------------
// /api/owner/*
// ---------------------------------------------------------------------------

describe("/api/owner/*: owner A against salon B", () => {
  let a: Owner & { ids: Ids };
  let b: Owner & { ids: Ids };
  let twin: Owner & { ids: Ids };

  beforeAll(async () => {
    a = await populate("Alfa");
    // B's counter is far ahead of A's, so none of B's ids exists in A and an id of B that works in A's hands is a leak.
    b = await populate("Beta", 60);
    // The twin is built exactly like A: it holds the same ids.
    twin = await populate("Delta");
  });

  const everyId = (ids: Ids) => [...ids.services, ...ids.customers, ...ids.bookings, ids.publicRef, ids.inbox, ids.trash, ids.log];

  it("never gives A anything of B's in what it reads, and the preconditions of the attacks below hold", async () => {
    const loaded = await (await read(a.cookie)).json();
    expect(loaded.state.salon.name).toContain("Alfa");
    const body = text(loaded);
    for (const secret of [b.tenantId, b.accountId, b.email, b.ids.email, b.ids.phone, b.ids.name, b.ids.publicRef, ...b.ids.bookings, (await stateOf(b.tenantId)).state.salon.slug, "Beta"]) {
      expect(body, secret).not.toContain(secret);
    }
    // The ids the attacks name are B's alone, so a success could only mean a leak.
    const own = allIds((await stateOf(a.tenantId)).state);
    for (const id of everyId(b.ids)) expect(own.has(id), id).toBe(false);
    // The twin is the opposite: every counter id of A's is in it too.
    const twinOwn = allIds((await stateOf(twin.tenantId)).state);
    for (const id of [...a.ids.services, ...a.ids.customers, a.ids.inbox, a.ids.trash, a.ids.log]) expect(twinOwn.has(id), id).toBe(true);
    // `me` says who is signed in and nothing about any tenant.
    const me = await getMe(ownerRequest("/api/owner/me", { cookie: a.cookie }));
    expect(await me.json()).toEqual({ email: a.email, mfaEnabled: false, session: expect.stringMatching(new RegExp(`^${a.accountId}\\.\\d+$`)) });
  });

  it("ignores every other way a request can name a tenant: query, headers and extra fields", async () => {
    const before = await snapshot(b.tenantId);
    const slug = (await stateOf(b.tenantId)).state.salon.slug;
    const naming = { "x-tenant-id": b.tenantId, "x-salon-id": b.tenantId, "x-forwarded-host": `${slug}.localhost`, "x-original-url": `/api/owner/salon?tenantId=${b.tenantId}` };
    for (const path of [`/api/owner/salon?tenantId=${b.tenantId}`, `/api/owner/salon?tenant_id=${b.tenantId}&slug=${slug}&salon=${slug}`, `/api/owner/salon/${b.tenantId}`]) {
      const response = await read(a.cookie, path, naming);
      if (path.endsWith(b.tenantId)) continue;
      expect((await response.json()).state.salon.name, path).toContain("Alfa");
    }
    // A valid change with every header: it lands in A, and in A only.
    const versionB = (await stateOf(b.tenantId)).version;
    const changed = await send(a.cookie, { action: { type: "card/dismiss", id: "iso-header" }, idempotencyKey: `iso-${run}-headers` }, naming, `/api/owner/salon/actions?tenantId=${b.tenantId}`);
    expect(changed.status).toBe(200);
    expect((await stateOf(a.tenantId)).state.dismissedCards).toContain("iso-header");
    // Fields in the body or in the action that name a tenant are not part of the contract at all.
    const good = { type: "card/dismiss", id: "iso-body" };
    for (const field of ["tenantId", "tenant_id", "salonId", "tenant", "slug", "salon", "accountId"]) {
      expect((await send(a.cookie, { action: good, idempotencyKey: `iso-${run}-${field}`, [field]: b.tenantId })).status, `body.${field}`).toBe(400);
      expect((await send(a.cookie, { action: { ...good, [field]: b.tenantId }, idempotencyKey: `iso-${run}-in-${field}` })).status, `action.${field}`).toBe(400);
    }
    expect((await send(a.cookie, { action: { type: "salon/hours", tenantId: b.tenantId, hours: [] }, idempotencyKey: `iso-${run}-hours` })).status).toBe(400);
    expect((await stateOf(b.tenantId)).version).toBe(versionB);
    expect(await snapshot(b.tenantId)).toEqual(before);
  });

  /** The changes that name an existing record by id, built from one salon's ids. */
  const naming = (x: Ids): Array<[string, unknown]> => [
    ["booking/cancel", { type: "booking/cancel", id: x.bookings[0] }],
    ["booking/move", { type: "booking/move", id: x.bookings[1], date: DATE, start: 900 }],
    ["booking/update", { type: "booking/update", id: x.bookings[2], patch: { note: "Fictional note" } }],
    ["booking/create for a customer of B", { type: "booking/create", serviceId: x.services[0], staffId: x.staff, date: DATE, start: 840, source: "phone", customerId: x.customers[0] }],
    ["customer/update", { type: "customer/update", id: x.customers[1], patch: { email: "changed@example.test" } }],
    ["customer/note", { type: "customer/note", id: x.customers[2], note: "Fictional note" }],
    ["customer/delete", { type: "customer/delete", id: x.customers[3] }],
    ["journal/add for a customer of B", { type: "journal/add", entry: { customerId: x.customers[0], date: TODAY, staffId: x.staff, treatment: "Fictional", observations: "Fictional", advice: "Rest" } }],
    ["service/update", { type: "service/update", id: x.services[0], service: { name: "Renamed", duration: 30, price: 1, category: x.category, description: "Fictional", staffIds: [x.staff] } }],
    ["service/price", { type: "service/price", id: x.services[1], price: 1 }],
    ["service/delete", { type: "service/delete", id: x.services[2] }],
    ["inbox/read", { type: "inbox/read", id: x.inbox }],
    ["trash/restore", { type: "trash/restore", id: x.trash }],
    ["log/undo", { type: "log/undo", id: x.log }],
  ];

  it("refuses every change that names a record of B, and the same changes work on the owner's own records", async () => {
    // Controls: a third salon does each of them to its own records.
    const c = await populate("Gamma");
    for (const [label, action] of naming(c.ids)) expect((await act(c.cookie, action)).status, `control ${label}`).toBe(200);

    const beforeB = await snapshot(b.tenantId);
    const beforeA = await snapshot(a.tenantId);
    const attacks = [...naming(b.ids), ...["booking/cancel", "booking/update"].map((type): [string, unknown] => [`${type} by public reference`, type === "booking/cancel"
      ? { type, id: b.ids.publicRef } : { type, id: b.ids.publicRef, patch: { note: "Fictional note" } }])];
    for (const [label, action] of attacks) {
      const response = await act(a.cookie, action);
      expect([400, 404, 422], `${label}: ${response.status}`).toContain(response.status);
      expect(text(await response.json()), label).not.toContain("Beta");
    }
    // Nothing changed anywhere: not B's document, log, keys or outbox, and not A's.
    expect(await snapshot(b.tenantId)).toEqual(beforeB);
    expect(await snapshot(a.tenantId)).toEqual(beforeA);
  });

  it("acts on the caller's own record when another salon holds the same id, and never on the other's", async () => {
    // A and the twin both have k-9, svc-1, i-29...: the id names a record inside the caller's salon.
    const shared = a.ids.customers[0];
    expect(twin.ids.customers[0]).toBe(shared);
    const before = await snapshot(twin.tenantId);
    const noted = await act(a.cookie, { type: "customer/note", id: shared, note: "Fictional note in A only" });
    expect(noted.status).toBe(200);
    expect(await snapshot(twin.tenantId)).toEqual(before);
    expect((await stateOf(a.tenantId)).state.customers.find((c) => c.id === shared)!.note).toContain("A only");
    expect((await stateOf(twin.tenantId)).state.customers.find((c) => c.id === shared)!.note ?? "").not.toContain("A only");
    const priced = await act(a.cookie, { type: "service/price", id: a.ids.services[0], price: 9999 });
    expect(priced.status).toBe(200);
    expect((await stateOf(twin.tenantId)).state.services.find((s) => s.id === a.ids.services[0])!.price).not.toBe(9999);
    // Erasure by the shared id needs the name of the caller's own customer, and then erases the caller's own.
    const wrongName = await erase(a.cookie, { customerId: shared, name: twin.ids.name });
    expect(wrongName.status).toBe(409);
    expect(await snapshot(twin.tenantId)).toEqual(before);
    const erased = await erase(a.cookie, { customerId: shared, name: a.ids.name });
    expect(erased.status).toBe(200);
    expect((await stateOf(a.tenantId)).state.customers.some((c) => c.id === shared)).toBe(false);
    expect(await snapshot(twin.tenantId)).toEqual(before);
    expect((await stateOf(twin.tenantId)).state.customers.some((c) => c.id === shared)).toBe(true);
  });

  it("answers B's record and an invented one alike, so a record cannot be probed for", async () => {
    const real = await act(a.cookie, { type: "booking/cancel", id: b.ids.bookings[3] });
    const invented = await act(a.cookie, { type: "booking/cancel", id: randomUUID() });
    expect([real.status, await real.json()]).toEqual([invented.status, await invented.json()]);
    const realErase = await erase(a.cookie, { customerId: b.ids.customers[0], name: b.ids.name });
    const inventedErase = await erase(a.cookie, { customerId: `k-${randomUUID()}`, name: b.ids.name });
    const [x, y] = [await realErase.json(), await inventedErase.json()];
    expect([realErase.status, x.pendingPayments, x.inFlightMessages, x.version]).toEqual([inventedErase.status, y.pendingPayments, y.inFlightMessages, y.version]);
  });

  it("cannot erase B's customer with A's cookie and B's id, name and contact details", async () => {
    // A holds a customer with the same name, phone and email as B's first one, under another id.
    const twin = { ...customerRow("Alfa", 9, a.ids.staff), firstName: b.ids.name.split(" ")[0], lastName: "Testsson", phone: b.ids.phone, email: b.ids.email };
    expect((await act(a.cookie, { type: "customers/import", customers: [twin] })).status).toBe(200);
    const beforeB = await snapshot(b.tenantId);
    const response = await erase(a.cookie, { customerId: b.ids.customers[0], name: b.ids.name });
    expect(response.status).toBe(200);
    expect(await snapshot(b.tenantId)).toEqual(beforeB);
    expect((await stateOf(b.tenantId)).state.customers.some((c) => c.id === b.ids.customers[0])).toBe(true);
    // A's twin is A's own: it was not touched either, because the erase named another id.
    expect((await stateOf(a.tenantId)).state.customers.some((c) => c.email === b.ids.email)).toBe(true);
    // The same customer, imported twice under the same contact details, is two records: A never reaches B's through a dedupe.
    expect((await stateOf(b.tenantId)).state.customers.filter((c) => c.email === b.ids.email)).toHaveLength(1);
  });

  it("takes B's address only for B: the slug of another salon is refused and B keeps serving", async () => {
    const slug = (await stateOf(b.tenantId)).state.salon.slug;
    const before = await snapshot(b.tenantId);
    const response = await act(a.cookie, { type: "salon/slug", slug });
    expect([response.status, (await response.json()).error]).toEqual([422, "slug_taken"]);
    expect((await stateOf(a.tenantId)).state.salon.slug).not.toBe(slug);
    expect(await snapshot(b.tenantId)).toEqual(before);
  });

  it("does not share an idempotency key between salons: the same key and body is applied once in each", async () => {
    const key = `shared-key-${run}`;
    const service = { name: `Fictional shared ${run}`, duration: 45, price: 400, category: a.ids.category, description: "Fictional", staffIds: [a.ids.staff] };
    const body = (staff: string, category: string) => ({ action: { type: "service/add", service: { ...service, category, staffIds: [staff] } }, idempotencyKey: key });
    const first = await (await send(a.cookie, body(a.ids.staff, a.ids.category))).json();
    expect(first.replayed).toBe(false);
    // B uses A's key with the identical request: it is B's own first use, not A's receipt.
    const second = await (await send(b.cookie, body(b.ids.staff, b.ids.category))).json();
    expect(second.replayed).toBe(false);
    expect(second.state.salon.name).toContain("Beta");
    expect(second.state.services.filter((s: { name: string }) => s.name === service.name)).toHaveLength(1);
    // B uses A's key for a different request: that is no "mismatch", which would say A has the key.
    const other = await send(b.cookie, { action: { type: "card/dismiss", id: "other-use" }, idempotencyKey: `other-${run}` });
    expect(other.status).toBe(200);
    const fresh = await send(b.cookie, { action: { type: "card/dismiss", id: "reuse-with-another-action" }, idempotencyKey: key });
    expect(fresh.status).toBe(409); // B's own key, now used for another request: the mismatch is B's.
    expect(await (await send(a.cookie, body(a.ids.staff, a.ids.category))).json()).toMatchObject({ replayed: true, version: first.version });
    // Each salon has exactly one row for it.
    for (const tenant of [a.tenantId, b.tenantId]) {
      const rows = await db.$queryRaw<Array<{ n: bigint }>>`SELECT count(*) AS n FROM tenant_idempotency WHERE tenant_id = ${tenant} AND key = ${key}`;
      expect(Number(rows[0].n)).toBe(1);
    }
    expect((await stateOf(a.tenantId)).state.services.filter((s) => s.name === service.name)).toHaveLength(1);
  });

  it("answers a first use of a key that only another salon holds like any first use", async () => {
    const key = `probe-${run}`;
    expect((await send(a.cookie, { action: { type: "card/dismiss", id: "probe-a" }, idempotencyKey: key })).status).toBe(200);
    const probe = await send(b.cookie, { action: { type: "card/dismiss", id: "probe-b" }, idempotencyKey: key });
    expect([probe.status, (await probe.json()).replayed]).toEqual([200, false]);
    expect((await stateOf(b.tenantId)).state.dismissedCards).toContain("probe-b");
    expect((await stateOf(b.tenantId)).state.dismissedCards).not.toContain("probe-a");
  });

  it("keeps a session of A from touching B: forged cookies, sign-out and sign-out everywhere", async () => {
    const value = (cookie: string) => cookie.slice(OWNER_COOKIE.length + 1);
    const [tokenA, idleA, absA, sigA] = value(a.cookie).split(".");
    const [tokenB, idleB, absB, sigB] = value(b.cookie).split(".");
    for (const forged of [`${tokenB}.${idleA}.${absA}.${sigA}`, `${tokenA}.${idleB}.${absB}.${sigB}`, `${tokenB}.${idleB}.${absB}.${sigA}`, `${tokenA}.${idleA}.${absA}.${sigB}`]) {
      expect((await read(`${OWNER_COOKIE}=${forged}`)).status, forged).toBe(401);
      expect((await send(`${OWNER_COOKIE}=${forged}`, { action: { type: "card/dismiss", id: "forged" }, idempotencyKey: `forged-${run}` })).status).toBe(401);
    }
    // A request that carries both salons' cookies is served one salon, whole, never a mix of the two.
    const both = (await (await read(`${a.cookie}; ${OWNER_COOKIE}=${value(b.cookie)}`)).json()).state as DemoState;
    const whose = both.salon.name.includes("Alfa") ? a : b;
    expect(both).toEqual((await stateOf(whose.tenantId)).state);

    const second = await owner("Alfa two");
    const secondB = await reopen(b.accountId);
    const bTwo = `${OWNER_COOKIE}=${secondB!.value}`;
    // Signing out with A's cookie ends A's session and no other.
    expect((await logout(ownerRequest("/api/owner/logout", { cookie: a.cookie, body: {} }))).status).toBe(200);
    expect((await read(a.cookie)).status).toBe(401);
    expect((await read(b.cookie)).status).toBe(200);
    // Signing out everywhere ends the account's sessions only.
    const [one, two] = [await reopen(second.accountId), await reopen(second.accountId)];
    expect((await logoutAll(ownerRequest("/api/owner/logout-all", { cookie: `${OWNER_COOKIE}=${one!.value}`, body: {} }))).status).toBe(200);
    for (const gone of [one, two]) expect((await read(`${OWNER_COOKIE}=${gone!.value}`)).status).toBe(401);
    expect((await read(b.cookie)).status).toBe(200);
    expect((await read(bTwo)).status).toBe(200);
    expect((await logoutAll(ownerRequest("/api/owner/logout-all", { cookie: bTwo, body: {} }))).status).toBe(200);
    expect((await read(b.cookie)).status).toBe(401);
    // A's own account and salon are intact after all that.
    const again = await reopen(a.accountId);
    expect((await (await read(`${OWNER_COOKIE}=${again!.value}`)).json()).state.salon.name).toContain("Alfa");
  });
});

// ---------------------------------------------------------------------------
// /api/public/salons/[slug]/bookings/*
// ---------------------------------------------------------------------------

describe("/api/public/salons/[slug]/bookings/*: a link of salon A against salon B", () => {
  let calls = 0;
  const headers = (key?: string) => {
    const ip = `10.9.${Math.floor(++calls / 250)}.${calls % 250}`;
    return { "content-type": "application/json", host: "localhost", origin, "x-booking-client-ip": ip, "x-booking-client-proof": addressProof(ip, SECRET), ...(key ? { "idempotency-key": key } : {}) };
  };
  const path = (slug: string, ref: string) => `${origin}/api/public/salons/${slug}/bookings/${ref}`;
  const ctx = (slug: string, ref: string) => ({ params: Promise.resolve({ slug, id: ref }) });
  const look = (slug: string, ref: string, token: string) => view(new NextRequest(path(slug, ref), { method: "POST", headers: headers(), body: JSON.stringify({ token }) }), ctx(slug, ref));
  const change = (route: typeof cancel, slug: string, ref: string, body: object, key: string = randomUUID()) =>
    route(new NextRequest(`${path(slug, ref)}/x`, { method: "POST", headers: headers(key), body: JSON.stringify(body) }), ctx(slug, ref));

  interface Salon { tenantId: string; slug: string; staff: string; serviceId: string; label: string }

  /** A salon whose treatment is its `services`-th: its id (`svc-5` for the third) exists in no salon with fewer treatments. */
  async function salon(label: string, services = 1): Promise<Salon> {
    const who = await owner(label);
    const { state } = await stateOf(who.tenantId);
    let last = state;
    for (let n = 1; n <= services; n++) {
      const service = { name: `${label} fotvård ${n}`, category: state.categories[0].id, duration: 60, price: 500, description: "Fictional", staffIds: [state.staff[0].id] };
      const added = await store().apply(who.tenantId, { type: "service/add", service });
      if (!added.ok) throw new Error("service not added");
      last = added.state;
    }
    return { tenantId: who.tenantId, slug: state.salon.slug, staff: state.staff[0].id, serviceId: last.services.at(-1)!.id, label };
  }

  /** A public booking, made as the booking page makes it, and the token of its e-mail link. */
  async function booked(s: Salon, start: number, publicRef = randomUUID(), same?: { name: string; phone: string; email: string }) {
    const { state } = await stateOf(s.tenantId);
    const terms = acceptedTerms(state, state.services.find((x) => x.id === s.serviceId)!);
    const guest = { ...(same ?? { name: `Guest ${s.label}`, phone: `0735${String(560000 + ++calls)}`, email: `guest-${s.label}-${calls}-${run}@customers.example.test` }), at: { date: "1970-01-01", time: 0 } };
    const result = await store().apply(s.tenantId, {
      type: "online/book", guest, serviceId: s.serviceId, staffId: s.staff as never, date: DATE, start, public: { slug: s.slug, terms, publicRef },
    } as DemoAction, { actor: "customer", source: "customer-page" });
    if (!result.ok) throw new Error(`booking refused: ${result.reason}`);
    const booking = result.state.bookings.find((b) => b.publicRef === publicRef)!;
    return { booking, ref: publicRef, token: tokenFor(s.tenantId, booking), seen: { staffId: s.staff, date: DATE, start } };
  }
  const tokenFor = (tenantId: string, booking: Booking) => mintBookingToken(
    { tenantId, bookingId: booking.id, ref: booking.publicRef!, customerId: booking.customerId, purpose: "manage", contactEmail: booking.contactEmail ?? "" }, bookingTokenExpiry(booking));

  const status = async (s: Salon, ref: string) => (await stateOf(s.tenantId)).state.bookings.find((b) => b.publicRef === ref);

  let a: Salon;
  let b: Salon;
  let one: Awaited<ReturnType<typeof booked>>;
  let two: Awaited<ReturnType<typeof booked>>;

  beforeAll(async () => {
    a = await salon("Citron", 3);
    b = await salon("Dahlia");
    one = await booked(a, 540);
    two = await booked(b, 540);
  });

  const notFound = { error: "not_found" };

  it("opens each booking with its own link and only there (controls)", async () => {
    for (const [s, x] of [[a, one], [b, two]] as const) {
      const response = await look(s.slug, x.ref, x.token);
      expect(response.status).toBe(200);
      expect((await response.json()).booking).toMatchObject({ date: DATE, start: 540 });
    }
  });

  it("answers a link of A on B's address, B's reference or B's booking with the same 404 as any bad link, and never shows B's booking", async () => {
    const garbage = await look(b.slug, two.ref, "v1.not.a.token");
    expect([garbage.status, await garbage.json()]).toEqual([404, notFound]);
    const combinations: Array<[string, string, string, string]> = [
      ["A's link, B's address, A's reference", b.slug, one.ref, one.token],
      ["B's link, A's address, B's reference", a.slug, two.ref, two.token],
      ["A's link, B's address, B's reference", b.slug, two.ref, one.token],
      ["B's link, A's address, A's reference", a.slug, one.ref, two.token],
      ["A's link, A's address, B's reference", a.slug, two.ref, one.token],
      ["B's link, B's address, A's reference", b.slug, one.ref, two.token],
      ["A's reference inside B's token", b.slug, two.ref, one.token.replace(one.ref, two.ref)],
    ];
    for (const [label, slug, ref, token] of combinations) {
      const response = await look(slug, ref, token);
      expect([response.status, await response.json()], `view: ${label}`).toEqual([404, notFound]);
    }
  });

  it("refuses to cancel or move across salons, and nothing changes in either", async () => {
    const before = [await snapshot(a.tenantId), await snapshot(b.tenantId)];
    const combinations: Array<[string, string, string, string, typeof one]> = [
      ["A's link on B's address", b.slug, one.ref, one.token, one],
      ["B's link on A's address", a.slug, two.ref, two.token, two],
      ["A's link, B's address, B's reference", b.slug, two.ref, one.token, one],
      ["B's link, A's address, A's reference", a.slug, one.ref, two.token, two],
    ];
    for (const [label, slug, ref, token, owned] of combinations) {
      const body = { token, expected: owned.seen };
      const cancelled = await change(cancel, slug, ref, body);
      expect([cancelled.status, await cancelled.json()], `cancel: ${label}`).toEqual([404, notFound]);
      const moved = await change(move, slug, ref, { ...body, staffId: owned.seen.staffId, date: DATE, start: 1200 });
      expect([moved.status, await moved.json()], `move: ${label}`).toEqual([404, notFound]);
    }
    expect(await snapshot(a.tenantId)).toEqual(before[0]);
    expect(await snapshot(b.tenantId)).toEqual(before[1]);
    expect((await status(a, one.ref))).toMatchObject({ status: "booked", start: 540 });
    expect((await status(b, two.ref))).toMatchObject({ status: "booked", start: 540 });
  });

  it("does not let a reference that two salons share open the other's booking", async () => {
    const shared = randomUUID();
    const mine = await booked(a, 600, shared);
    const theirs = await booked(b, 600, shared);
    // Each link opens its own booking at its own address, though the reference is the same.
    expect((await look(a.slug, shared, mine.token)).status).toBe(200);
    expect((await look(b.slug, shared, theirs.token)).status).toBe(200);
    // A's link names the same reference at B's address: the token binds the salon, the booking and its customer.
    const before = await snapshot(b.tenantId);
    for (const [label, route] of [["view", undefined], ["cancel", cancel], ["move", move]] as const) {
      const response = route
        ? await change(route, b.slug, shared, { token: mine.token, expected: mine.seen, staffId: mine.seen.staffId, date: DATE, start: 1230 })
        : await look(b.slug, shared, mine.token);
      expect([response.status, await response.json()], label).toEqual([404, notFound]);
    }
    expect(await snapshot(b.tenantId)).toEqual(before);
    expect(await status(b, shared)).toMatchObject({ status: "booked", start: 600 });
    // B's own cancel works, and cancels B's booking only.
    const cancelled = await change(cancel, b.slug, shared, { token: theirs.token, expected: theirs.seen });
    expect(cancelled.status).toBe(200);
    expect(await status(b, shared)).toMatchObject({ status: "cancelled" });
    expect(await status(a, shared)).toMatchObject({ status: "booked" });
  });

  it("binds a link to its salon even when two salons hold the same booking, customer, reference and address", async () => {
    // Two salons built the same way, with the same guest booking the same time: every field of the booking but the salon is equal.
    const [left, right] = [await salon("Eka"), await salon("Tvaa")];
    const guest = { name: "Same Guest", phone: "0735559900", email: `same-guest-${run}@customers.example.test` };
    const reference = randomUUID();
    const [l, r] = [await booked(left, 660, reference, guest), await booked(right, 660, reference, guest)];
    expect([l.booking.id, l.booking.customerId, l.booking.contactEmail]).toEqual([r.booking.id, r.booking.customerId, r.booking.contactEmail]);
    expect(l.token).not.toBe(r.token);
    expect((await look(left.slug, reference, l.token)).status).toBe(200);
    expect((await look(right.slug, reference, r.token)).status).toBe(200);
    const before = await snapshot(right.tenantId);
    // Left's link on right's address names a booking that exists there, with every field the link covers except the salon.
    for (const [label, route] of [["view", undefined], ["cancel", cancel], ["move", move]] as const) {
      const response = route
        ? await change(route, right.slug, reference, { token: l.token, expected: l.seen, staffId: l.seen.staffId, date: DATE, start: 780 })
        : await look(right.slug, reference, l.token);
      expect([response.status, await response.json()], label).toEqual([404, notFound]);
    }
    expect(await snapshot(right.tenantId)).toEqual(before);
    expect(await status(right, reference)).toMatchObject({ status: "booked", start: 660 });
  });

  it("keeps each salon's calendar to itself: the other's bookings neither block a time nor show up", async () => {
    // B's booking holds 09:00 on the day; A moves its own booking to 09:00 as well and gets it.
    const free = await booked(a, 660);
    expect(await status(b, two.ref)).toMatchObject({ start: 540, status: "booked" });
    const moved = await change(move, a.slug, free.ref, { token: free.token, expected: free.seen, staffId: free.seen.staffId, date: DATE, start: 780 });
    expect(moved.status).toBe(200);
    expect((await moved.json()).booking).toMatchObject({ start: 780 });
    // And each salon's link now shows only that salon's visit: the view carries no data of the other.
    const shown = text(await (await look(b.slug, two.ref, two.token)).json());
    for (const secret of [a.tenantId, a.slug, one.ref, one.booking.id, `Guest ${a.label}`]) expect(shown, secret).not.toContain(secret);
  });

  it("shares no idempotency key between salons for cancel and move", async () => {
    const x = await booked(a, 720);
    const y = await booked(b, 720);
    const key = `link-key-${run}`;
    const first = await change(cancel, a.slug, x.ref, { token: x.token, expected: x.seen }, key);
    expect(first.status).toBe(200);
    // B reuses A's key for B's own booking: processed as a first use, and B's booking is the one cancelled.
    const second = await change(cancel, b.slug, y.ref, { token: y.token, expected: y.seen }, key);
    expect(second.status).toBe(200);
    expect((await second.json()).booking).toMatchObject({ status: "cancelled", start: 720 });
    expect(await status(b, y.ref)).toMatchObject({ status: "cancelled" });
    // A's replay is A's receipt; B's key row is B's. Neither carries the other's booking.
    const replay = await change(cancel, a.slug, x.ref, { token: x.token, expected: x.seen }, key);
    expect(replay.status).toBe(200);
    const stored = await db.$queryRaw<Array<{ tenant_id: string; result: { state: { salon: { slug: string } } } }>>`
      SELECT tenant_id, result FROM tenant_idempotency WHERE key = ${`booking-cancel:${key}`} ORDER BY tenant_id`;
    expect(stored.map((row) => [row.tenant_id, row.result.state.salon.slug]).sort()).toEqual([[a.tenantId, a.slug], [b.tenantId, b.slug]].sort());
    // B reuses A's key for a move on a booking of its own: a first use, not a mismatch with A's cancel.
    const z = await booked(b, 840);
    const moved = await change(move, b.slug, z.ref, { token: z.token, expected: z.seen, staffId: z.seen.staffId, date: DATE, start: 900 }, `move-${key}`);
    const movedByA = await booked(a, 840);
    const again = await change(move, a.slug, movedByA.ref, { token: movedByA.token, expected: movedByA.seen, staffId: movedByA.seen.staffId, date: DATE, start: 900 }, `move-${key}`);
    expect([moved.status, again.status]).toEqual([200, 200]);
  });

  it("books nothing at B with A's service, staff member or form token", async () => {
    const { state } = await stateOf(a.tenantId);
    const terms = acceptedTerms(state, state.services.find((x) => x.id === a.serviceId)!);
    const attempt = (slug: string, tenantId: string, over: Record<string, unknown>) => {
      const body = {
        serviceId: a.serviceId, staffId: a.staff, date: DATE, start: 960, name: "Lisa Berg", phone: `0735${String(570000 + ++calls)}`, email: "lisa@example.test",
        language: "en", website: "", terms, issuedAt: issuedAtToken(tenantId, slug, Date.now() - 10_000), ...over,
      };
      return book(new NextRequest(`${origin}/api/public/salons/${slug}/bookings`, { method: "POST", headers: headers(randomUUID()), body: JSON.stringify(body) }), { params: Promise.resolve({ slug }) });
    };
    const before = await snapshot(b.tenantId);
    // A's form token on B's address, and B's form token with A's treatment: refused, nothing written.
    expect((await attempt(b.slug, a.tenantId, {})).status).toBe(422);
    const wrongService = await attempt(b.slug, b.tenantId, {});
    expect([409, 422]).toContain(wrongService.status);
    expect(await snapshot(b.tenantId)).toEqual(before);
    // Control: A's form token and A's own treatment on A's address books.
    expect((await attempt(a.slug, a.tenantId, {})).status).toBe(201);
    expect((await stateOf(b.tenantId)).state.bookings.filter((x) => x.start === 960)).toHaveLength(0);
  });

  it("looks a salon up by its exact address: no wildcard, prefix or case trick reaches another salon", async () => {
    for (const slug of ["%", "_", "%25", `${b.slug.slice(0, -1)}%`, `${b.slug.slice(0, -1)}_`, `%${b.slug.slice(1)}`, `${b.slug}%`, "' OR '1'='1", `${b.slug}\\`, `${b.slug}/../${a.slug}`]) {
      const response = await look(slug, two.ref, two.token);
      expect(response.status, slug).toBe(404);
    }
    // Control, with the one variation the address allows: letter case.
    expect((await look(b.slug.toUpperCase(), two.ref, two.token)).status).toBe(200);
  });

  it("serves a salon, not a demo or sandbox row that carries its address and booking reference", async () => {
    const { state } = await stateOf(b.tenantId);
    const impostor = `${PREFIX}-impostor-${randomUUID().slice(0, 6)}`;
    // A demo tenant holding a copy of B's salon (same address, same booking), with another guest on it.
    const copy = { ...state, bookings: state.bookings.map((x) => ({ ...x, contactEmail: "impostor@example.test" })) };
    for (const kind of ["demo", "sandbox"] as const) {
      const id = `${impostor}-${kind}`;
      await db.$executeRaw`INSERT INTO tenant_state (tenant_id, kind, version, doc) VALUES (${id}, ${kind}::tenant_kind, 0, ${JSON.stringify(copy)}::jsonb)`;
      const response = await look(b.slug, two.ref, two.token);
      expect(response.status, kind).toBe(200);
      expect(text(await response.json()), kind).not.toContain("impostor@example.test");
    }
  });
});

// ---------------------------------------------------------------------------
// The store, directly
// ---------------------------------------------------------------------------

const seedTenant = async (tenantId: string, kind: TenantKind = "salon", saved: unknown = createDemoState(TODAY), expiresAt: string | null = null, client: PrismaClient = prisma) =>
  client.$executeRawUnsafe(
    `INSERT INTO tenant_state (tenant_id, kind, version, doc, expires_at) VALUES ($1, $2::public.tenant_kind, 0, $3::jsonb, $4::timestamptz)`,
    tenantId, kind, JSON.stringify(withOwnSlug(saved, tenantId)), expiresAt);

const tenant = (label: string) => `${PREFIX}-${label}-${randomUUID().slice(0, 8)}`;

function recordingSinks() {
  const delivered: EffectDelivery[] = [];
  const sink = (delivery: EffectDelivery) => { delivered.push(delivery); };
  const sinks: EffectSinks = { payment: sink, message: sink };
  return { delivered, sinks, of: (tenantId: string) => delivered.filter((d) => d.tenantId === tenantId) };
}

describe("the store: load, apply, history and erase stay inside one tenant", () => {
  const stores: PostgresStudioStore[] = [];
  const make = (options: Partial<ConstructorParameters<typeof PostgresStudioStore>[0]> = {}) => {
    const created = new PostgresStudioStore({ prisma, hmacSecret, sinks: recordingSinks().sinks, now: fixedClock, ...options });
    stores.push(created);
    return created;
  };
  afterAll(() => stores.forEach((s) => s.close()));

  it("treats an id that only looks like a tenant's as no tenant: nothing is read, written or created", async () => {
    const real = tenant("real");
    await seedTenant(real);
    const s = make();
    expect((await s.apply(real, { type: "card/dismiss", id: "real-only" })).ok).toBe(true);
    const before = await snapshot(real);
    const lookalikes = ["%", "_", `${real.slice(0, -1)}%`, `${real.slice(0, -1)}_`, real.toUpperCase(), ` ${real}`, `${real} `, `${real}​`, `${real}-2`, real.slice(0, -1), "", "' OR '1'='1", "demo", "salon_"];
    for (const id of lookalikes) {
      expect(await s.load(id), JSON.stringify(id)).toBeNull();
      expect(await s.history(id, { limit: 50 }), JSON.stringify(id)).toEqual({ entries: [], next: null });
      expect(await s.apply(id, { type: "card/dismiss", id: "ghost" }), JSON.stringify(id)).toEqual({ ok: false, reason: "not-found" });
      expect(await s.apply(id, { type: "card/dismiss", id: "ghost" }, {}, { idempotencyKey: "ghost-key", expectedVersion: 1 }), JSON.stringify(id)).toEqual({ ok: false, reason: "not-found" });
      expect(await s.eraseSubject(id, "k-1"), JSON.stringify(id)).toEqual({ ok: false, reason: "not-found" });
    }
    expect(await snapshot(real)).toEqual(before);
    for (const table of ["tenant_state", "tenant_action", "tenant_idempotency", "tenant_effect"]) {
      const rows = await db.$queryRawUnsafe<Array<{ n: bigint }>>(`SELECT count(*) AS n FROM ${table} WHERE tenant_id = ANY($1)`, lookalikes.filter((id) => id !== real));
      expect(Number(rows[0].n), table).toBe(0);
    }
  });

  it("reads one tenant's history and state while another has the same sequence numbers and versions", async () => {
    const [x, y] = [tenant("hx"), tenant("hy")];
    await Promise.all([seedTenant(x), seedTenant(y)]);
    const s = make();
    for (const [id, tag] of [[x, "x"], [y, "y"]] as const) for (let n = 1; n <= 3; n++) expect((await s.apply(id, { type: "card/dismiss", id: `${tag}${n}` })).ok).toBe(true);
    const [hx, hy] = [await s.history(x, { limit: 50 }), await s.history(y, { limit: 2 })];
    expect(hx.entries.map((e) => [e.seq, e.tenantId, (e.action as { id: string }).id])).toEqual([[1, x, "x1"], [2, x, "x2"], [3, x, "x3"]]);
    expect(hy.entries.map((e) => [e.seq, e.tenantId, (e.action as { id: string }).id])).toEqual([[1, y, "y1"], [2, y, "y2"]]);
    expect((await s.history(y, { after: hy.next!, limit: 50 })).entries.map((e) => e.tenantId)).toEqual([y]);
    expect((await s.load(x))!.state.dismissedCards).toEqual(expect.arrayContaining(["x1", "x2", "x3"]));
    expect((await s.load(x))!.state.dismissedCards).not.toContain("y1");
    // A stale version of one tenant is judged against that tenant, not the other.
    expect(await s.apply(x, { type: "card/dismiss", id: "x4" }, {}, { expectedVersion: 3 })).toMatchObject({ ok: true, version: 4 });
    expect(await s.apply(y, { type: "card/dismiss", id: "y4" }, {}, { expectedVersion: 3 })).toMatchObject({ ok: true, version: 4 });
  });

  it("scopes an idempotency key to its tenant: a replay is the tenant's own, another tenant's first use is a first use", async () => {
    const [x, y] = [tenant("kx"), tenant("ky")];
    await Promise.all([seedTenant(x), seedTenant(y)]);
    const s = make();
    const same: DemoAction = { type: "card/dismiss", id: "same" };
    const first = await s.apply(x, same, {}, { idempotencyKey: "k" });
    // Another tenant, another request under the same key: no mismatch, which would reveal the key.
    const other = await s.apply(y, { type: "card/dismiss", id: "different" }, {}, { idempotencyKey: "k" });
    expect(first.ok && other.ok && !other.replayed && other.entry.tenantId === y).toBe(true);
    // And the same request under the same key is no replay of the other tenant's result.
    const twin = await s.apply(y, same, {}, { idempotencyKey: "k-twin" });
    const replayX = await s.apply(x, same, {}, { idempotencyKey: "k" });
    expect(replayX.ok && replayX.replayed && replayX.entry.tenantId === x && replayX.state.dismissedCards.includes("different")).toBe(false);
    expect(twin.ok && twin.replayed).toBe(false);
    // The stored result carries its own tenant's state only.
    const rows = await db.$queryRaw<Array<{ tenant_id: string; result: { entry: { tenantId: string }; state: { salon: { slug: string } } } }>>`
      SELECT tenant_id, result FROM tenant_idempotency WHERE tenant_id IN (${x}, ${y}) AND key = 'k' ORDER BY tenant_id`;
    expect(rows.map((r) => [r.tenant_id, r.result.entry.tenantId, r.result.state.salon.slug])).toEqual([[x, x, x], [y, y, y]].sort());
    // After the key expired in one tenant only, it runs again there and still replays in the other.
    const later = make({ now: async () => CLOCK + 25 * 3_600_000 });
    expect(await later.apply(x, same, {}, { idempotencyKey: "k" })).toMatchObject({ ok: false, reason: "rejected" });
    expect(await later.apply(y, { type: "card/dismiss", id: "fresh" }, {}, { idempotencyKey: "fresh" })).toMatchObject({ ok: true });
  });

  it("keeps the effect outbox per tenant: the same request is one row in each, and a delivery reaches only its tenant's rows", async () => {
    const [x, y] = [tenant("ex"), tenant("ey")];
    await Promise.all([seedTenant(x), seedTenant(y)]);
    const queued = make({ deliverAfterCommit: false });
    const text = (state: DemoState): DemoAction => ({
      type: "customers/message", at: { date: TODAY, time: 9 * 60 },
      texts: [{ customerId: state.customers[0].id, title: "Fictional reminder", body: `Hi ${state.customers[0].firstName}, see you soon.` }],
    });
    const message = text((await queued.load(x))!.state);
    expect((await queued.apply(x, message)).ok).toBe(true);
    expect((await queued.apply(y, message)).ok).toBe(true);
    const rows = async () => db.$queryRaw<Array<{ tenant_id: string; id: string; status: string; attempts: number }>>`
      SELECT tenant_id, id, status, attempts FROM tenant_effect WHERE tenant_id IN (${x}, ${y}) ORDER BY tenant_id, seq, n`;
    const staged = await rows();
    expect(staged.map((r) => [r.tenant_id, r.status])).toEqual([[x, "pending"], [y, "pending"]]);
    // The identical request has an id of its own in each tenant, and neither tenant's apply was refused for it.
    expect(new Set(staged.map((r) => r.id)).size).toBe(2);

    // An apply in X delivers X's due rows and leaves Y's alone, though both are due.
    const delivering = recordingSinks();
    const live = make({ sinks: delivering.sinks });
    expect((await live.apply(x, { type: "card/dismiss", id: "drain-x" })).ok).toBe(true);
    expect(delivering.of(x).length).toBeGreaterThan(0);
    expect(delivering.of(y)).toEqual([]);
    expect((await rows()).map((r) => [r.tenant_id, r.status, r.attempts])).toEqual([[x, "delivered", expect.any(Number)], [y, "pending", 0]]);
    // The poller told to serve Y does the same the other way round.
    const poller = recordingSinks();
    await drainPendingEffects({ prisma, sinks: poller.sinks, tenants: [y], now: fixedClock });
    expect(poller.delivered.every((d) => d.tenantId === y)).toBe(true);
    expect((await rows()).map((r) => r.status)).toEqual(["delivered", "delivered"]);
    // Each delivered row names its own tenant's customer reference and no one else's tenant id.
    const payloads = await db.$queryRaw<Array<{ tenant_id: string; payload: unknown }>>`SELECT tenant_id, payload FROM tenant_effect WHERE tenant_id IN (${x}, ${y})`;
    for (const row of payloads) expect(JSON.stringify(row.payload)).not.toContain(row.tenant_id === x ? y : x);
  });

  /** Two tenants with the same history and the same customers, ids and contact details: only the tenant id differs. */
  async function twins() {
    const [x, y] = [tenant("twx"), tenant("twy")];
    const base = createDemoState(TODAY);
    const customer = base.customers[0];
    const steps = (state: DemoState): Array<[DemoAction, string | undefined]> => [
      [{ type: "customer/update", id: customer.id, patch: { email: "twin.kund@example.test", phone: "0700001234" } }, undefined],
      [{ type: "customer/note", id: customer.id, note: `Fictional note about ${customer.firstName} ${customer.lastName}` }, "studio:note-twin.kund@example.test"],
      [{ type: "customers/message", at: { date: TODAY, time: 9 * 60 }, texts: [{ customerId: customer.id, title: "Fictional reminder", body: `Hi ${customer.firstName}, see you soon.` }] }, "studio:message-1"],
      [{ type: "customer/note", id: state.customers[1].id, note: "Fictional note about another customer" }, "studio:note-other"],
    ];
    const s = make({ deliverAfterCommit: false });
    for (const id of [x, y]) {
      await seedTenant(id);
      for (const [action, key] of steps(base)) expect((await s.apply(id, action, {}, key ? { idempotencyKey: key } : {})).ok, `${id} ${action.type}`).toBe(true);
    }
    return { x, y, customer, other: base.customers[1] };
  }

  /** The rows with one tenant's id replaced by the other's. An effect's id is derived from its tenant, so it is dropped. */
  const comparable = (rows: Record<Table, unknown[]>, from: string, to: string) => {
    const same = JSON.parse(JSON.stringify(rows).replaceAll(from, to)) as Record<Table, Array<Record<string, unknown>>>;
    same.effects.forEach((row) => delete row.id);
    return same;
  };
  const withoutEffectIds = (rows: Record<Table, unknown[]>) => ({ ...rows, effects: (rows.effects as Array<Record<string, unknown>>).map((row) => Object.fromEntries(Object.entries(row).filter(([column]) => column !== "id"))) });

  it("redacts an erased customer in their tenant only, though the other tenant holds the same customer, id, number and address", async () => {
    const { x, y, customer, other } = await twins();
    // The two histories are the same up to the tenant's id, so a difference afterwards is the erasure's.
    expect(comparable(await snapshot(x), x, y)).toEqual(withoutEffectIds(await snapshot(y)));
    const untouched = await snapshot(y);
    const s = make();
    const erased = await s.eraseSubject(x, customer.id);
    expect(erased).toMatchObject({ ok: true, pendingPayments: 0 });
    if (!erased.ok) return;
    expect(erased.redacted.actions).toBeGreaterThan(0);
    expect(erased.redacted.effects).toBeGreaterThan(0);
    expect(erased.redacted.idempotencyKeys).toBeGreaterThan(0);
    // The erased tenant lost the customer everywhere; the other lost nothing, in any column of any table.
    expect(await snapshot(y)).toEqual(untouched);
    expect((await s.load(y))!.state.customers.map((c) => c.id)).toContain(customer.id);
    expect((await s.load(x))!.state.customers.map((c) => c.id)).not.toContain(customer.id);
    expect((await s.load(x))!.state.customers.map((c) => c.id)).toContain(other.id);
    const left = JSON.stringify(await snapshot(x));
    for (const needle of ["twin.kund@example.test", "0700001234", `Fictional note about ${customer.firstName}`]) expect(left, needle).not.toContain(needle);
    // The other tenant still replays its own keyed change and still has its own address in its keys.
    const replay = await s.apply(y, { type: "customer/note", id: other.id, note: "Fictional note about another customer" }, {}, { idempotencyKey: "studio:note-other" });
    expect(replay).toMatchObject({ ok: true, replayed: true });
    expect(await count("tenant_idempotency", y)).toBe(untouched.keys.length);
    expect(JSON.stringify(await snapshot(y))).toContain("studio:note-twin.kund@example.test");
    expect((await db.$queryRaw<Array<{ status: string }>>`SELECT status FROM tenant_effect WHERE tenant_id = ${y}`).map((r) => r.status)).toEqual(["pending"]);
  });

  /** The statements of prisma/grants/erase-subject.sql with both roles set to the connecting role, as the durability tests install them. */
  async function installEraseSubject() {
    const [{ role }] = await db.$queryRaw<Array<{ role: string }>>`SELECT current_user::text AS role`;
    const quoted = `"${role.replaceAll('"', '""')}"`;
    const sql = readFileSync(new URL("../../prisma/grants/erase-subject.sql", import.meta.url), "utf8");
    const statements = sql.split("-- statement").slice(1)
      .map((statement) => statement.replaceAll(':"eraser_role"', quoted).replaceAll(':"app_role"', quoted))
      .filter((statement) => !/^\s*(BEGIN|COMMIT);/.test(statement));
    await db.$transaction(async (tx) => { for (const statement of statements) await tx.$executeRawUnsafe(statement); }, { timeout: 15_000 });
  }

  it("does the same through the erase_subject function of the production grants", async () => {
    const { x, y, customer } = await twins();
    const untouched = await snapshot(y);
    await installEraseSubject();
    try {
      const erased = await make({ erasure: "function" }).eraseSubject(x, customer.id);
      expect(erased).toMatchObject({ ok: true });
      // The function takes the tenant as an argument: naming the customer for the wrong tenant erases nothing there.
      expect(await snapshot(y)).toEqual(untouched);
      expect(JSON.stringify(await snapshot(x))).not.toContain("twin.kund@example.test");
      await expect(db.$queryRaw`SELECT erase_subject(${`${PREFIX}-nobody`}, ${customer.id}) AS counts`).rejects.toThrow(/unknown tenant/);
      expect(await snapshot(y)).toEqual(untouched);
    } finally {
      await db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS erase_subject(text, text), studio_redact_replay_action(jsonb, text, text[], text[], jsonb), studio_redact_replay(jsonb, text, text[], text[]),
        studio_scrub(jsonb, text[]), studio_scrub_text(text, text[]), studio_redact_path(jsonb, text[]), studio_phone_digits(text)`);
    }
  }, 30_000);
});

// ---------------------------------------------------------------------------
// The sweeps, in a private copy of the four tables so they only see this test's rows
// ---------------------------------------------------------------------------

describe("the sweeps leave other tenants' rows and kinds alone", () => {
  const setup = newClient();
  const schema = `tenant_isolation_${randomUUID().replaceAll("-", "")}`;
  let sweepDb: PrismaClient;
  let created = false;
  const NOW = Date.UTC(2026, 10, 16, 12, 0, 0);
  const DAY = 86_400_000;
  const now = async () => NOW;
  const at = (offset: number) => new Date(NOW + offset).toISOString();
  const tables = ["tenant_state", "tenant_action", "tenant_idempotency", "tenant_effect", `"RateLimitBucket"`];

  beforeAll(async () => {
    await setup.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`CREATE SCHEMA ${schema}`);
      for (const table of tables) await tx.$executeRawUnsafe(`CREATE TABLE ${schema}.${table} (LIKE public.${table} INCLUDING ALL)`);
    });
    created = true;
    const url = new URL(process.env.DATABASE_URL!);
    url.searchParams.set("options", `-c search_path=${schema},public`);
    sweepDb = newClient(url.href);
  });

  afterAll(async () => {
    if (created) await setup.$executeRawUnsafe(`DROP SCHEMA ${schema} CASCADE`);
  });

  const state = (id: string, kind: TenantKind, expiresAt: string | null = null) => seedTenant(id, kind, createDemoState(TODAY), expiresAt, sweepDb);
  const action = (id: string, seq: number, when: number, body: unknown, key: string | null = null) => sweepDb.$executeRaw`
    INSERT INTO tenant_action (tenant_id, seq, action, actor, source, at, idempotency_key, resulting_version, subject_ids)
    VALUES (${id}, ${seq}, ${JSON.stringify(body)}::jsonb, 'owner', 'button', ${at(when)}::timestamptz, ${key}, ${seq}, ARRAY[]::text[])`;
  const effect = (id: string, seq: number, status: string, payload: unknown) => sweepDb.$executeRaw`
    INSERT INTO tenant_effect (tenant_id, seq, n, id, fingerprint, kind, payload, status, next_attempt_at)
    VALUES (${id}, ${seq}, 0, ${`${id}-${seq}-${randomUUID()}`}, 'f', 'message', ${JSON.stringify(payload)}::jsonb, ${status}, ${at(0)}::timestamptz)`;
  const key = (id: string, name: string, expires: number) => sweepDb.$executeRaw`
    INSERT INTO tenant_idempotency (tenant_id, key, fingerprint_hmac, seq, result, expires_at) VALUES (${id}, ${name}, 'f', 1, '{}'::jsonb, ${at(expires)}::timestamptz)`;
  const keysOf = async (id: string) => (await sweepDb.$queryRaw<Array<{ key: string }>>`SELECT key FROM tenant_idempotency WHERE tenant_id = ${id} ORDER BY key`).map((r) => r.key);
  const rowsIn = async (id: string) => ({
    actions: await count("tenant_action", id), effects: await count("tenant_effect", id), keys: await count("tenant_idempotency", id), state: await count("tenant_state", id),
  });
  const count = async (table: string, id: string) => Number((await sweepDb.$queryRawUnsafe<Array<{ n: bigint }>>(`SELECT count(*) AS n FROM ${table} WHERE tenant_id = $1`, id))[0].n);
  const personal = { type: "customer/note", id: "k-1", note: "Fictional note about Lena Testsson" };
  const mail = { port: "email", action: "send", to: "lena@example.test", subject: "Your visit", body: "Hello Lena", cost: null };

  it("deletes an expired idempotency key of one tenant and keeps the same key of another that has not expired", async () => {
    const [x, y] = [tenant("ik-x"), tenant("ik-y")];
    await Promise.all([state(x, "salon"), state(y, "salon")]);
    await key(x, "shared", -2 * DAY);
    await key(x, "mine", -1);
    await key(y, "shared", DAY);
    await key(y, "mine", -DAY);
    expect(await sweepExpiredIdempotency({ prisma: sweepDb, now, batch: 1 })).toBe(3);
    expect(await keysOf(x)).toEqual([]);
    expect(await keysOf(y)).toEqual(["shared"]);
  });

  it("deletes the log of a demo tenant and not that of a salon with the same sequence numbers and age", async () => {
    const [demo, salon, sandbox] = [tenant("dl-demo"), tenant("dl-salon"), tenant("dl-sandbox")];
    await Promise.all([state(demo, "demo"), state(salon, "salon"), state(sandbox, "sandbox", at(DAY))]);
    for (const id of [demo, salon, sandbox]) for (const seq of [1, 2]) await action(id, seq, -30 * DAY, { type: "card/dismiss", id: "old" });
    await action(demo, 3, -1 * DAY, { type: "card/dismiss", id: "recent" });
    expect(await sweepDemoActions({ prisma: sweepDb, now, batch: 1 })).toBe(2);
    expect(await rowsIn(demo)).toMatchObject({ actions: 1, state: 1 });
    expect(await rowsIn(salon)).toMatchObject({ actions: 2, state: 1 });
    expect(await rowsIn(sandbox)).toMatchObject({ actions: 2, state: 1 });
  });

  it("removes an expired sandbox with its four tables and no other tenant, whatever its kind or expiry", async () => {
    const sandboxes = { gone: tenant("sb-gone"), live: tenant("sb-live") };
    const others = { salon: tenant("sb-salon"), demo: tenant("sb-demo"), lapsedSalon: tenant("sb-lapsed") };
    await state(sandboxes.gone, "sandbox", at(-DAY));
    await state(sandboxes.live, "sandbox", at(DAY));
    await state(others.salon, "salon");
    await state(others.demo, "demo", at(-DAY));
    await state(others.lapsedSalon, "salon", at(-DAY));
    for (const id of [...Object.values(sandboxes), ...Object.values(others)]) {
      await action(id, 1, -DAY, { type: "card/dismiss", id: "a" });
      await effect(id, 1, "pending", mail);
      await key(id, "k", DAY);
    }
    const before = Object.fromEntries(await Promise.all([...Object.values(sandboxes), ...Object.values(others)].map(async (id) => [id, await rowsIn(id)])));
    expect(await sweepExpiredSandboxes({ prisma: sweepDb, now, batch: 1 })).toEqual({ tenants: 1, actions: 1, effects: 1, idempotencyKeys: 1 });
    expect(await rowsIn(sandboxes.gone)).toEqual({ actions: 0, effects: 0, keys: 0, state: 0 });
    for (const id of [sandboxes.live, ...Object.values(others)]) expect(await rowsIn(id), id).toEqual(before[id]);
  });

  it("redacts the old personal data of one tenant's log and leaves the same sequence number of a recent tenant", async () => {
    const [old, recent] = [tenant("pd-old"), tenant("pd-recent")];
    await Promise.all([state(old, "salon"), state(recent, "salon")]);
    await action(old, 1, -500 * DAY, personal, "studio:note-lena@example.test");
    await action(recent, 1, -1 * DAY, personal, "studio:note-lena@example.test");
    await action(recent, 2, -500 * DAY, { type: "card/dismiss", id: "nothing personal" });
    const untouched = await snapshot(recent, sweepDb);
    expect(await sweepActivityPersonalData({ prisma: sweepDb, now, batch: 1 })).toBeGreaterThanOrEqual(1);
    const [oldRow] = await sweepDb.$queryRaw<Array<{ action: { note: string }; key: string | null; redacted: boolean }>>`SELECT action, idempotency_key AS key, redacted_at IS NOT NULL AS redacted FROM tenant_action WHERE tenant_id = ${old}`;
    expect(oldRow).toMatchObject({ action: { note: "[redacted]" }, key: null, redacted: true });
    expect(await snapshot(recent, sweepDb)).toEqual(untouched);
  });

  it("blanks the body of an old settled message of one tenant and keeps a recent one of another with the same sequence number", async () => {
    const [old, recent] = [tenant("ob-old"), tenant("ob-recent")];
    await Promise.all([state(old, "salon"), state(recent, "salon")]);
    await action(old, 1, -100 * DAY, { type: "customers/message" });
    await action(recent, 1, -1 * DAY, { type: "customers/message" });
    await effect(old, 1, "delivered", mail);
    await effect(recent, 1, "delivered", mail);
    const untouched = await snapshot(recent, sweepDb);
    expect(await sweepOutboxBodies({ prisma: sweepDb, now, batch: 1 })).toBe(1);
    const [row] = await sweepDb.$queryRaw<Array<{ payload: { body: string } }>>`SELECT payload FROM tenant_effect WHERE tenant_id = ${old}`;
    expect(row.payload.body).toBe("[redacted]");
    expect(await snapshot(recent, sweepDb)).toEqual(untouched);
  });
});
