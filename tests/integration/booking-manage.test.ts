import { randomBytes, randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as BOOK } from "../../src/app/api/public/salons/[slug]/bookings/route";
import { POST as CANCEL } from "../../src/app/api/public/salons/[slug]/bookings/[id]/cancel/route";
import { POST as MOVE } from "../../src/app/api/public/salons/[slug]/bookings/[id]/move/route";
import { addressProof } from "../../scripts/client-address.mjs";
import { acceptedTerms, type AcceptedTerms } from "../../src/concept/booking/public-terms";
import { ok } from "../../src/concept/connections/core";
import type { EmailMessage, EmailPort } from "../../src/concept/connections/ports/email";
import { drainPendingEffects, SIMULATED_SINKS } from "../../src/concept/store/effect-outbox";
import { PostgresStudioStore } from "../../src/concept/store/postgres-studio-store";
import { db } from "../../src/lib/db";
import { createOwnerAccount } from "../../src/lib/owner-accounts";
import { messageSink } from "../../src/lib/message-sink";
import { issuedAtToken } from "../../src/lib/public-issued-at";

// Cancel and move from the booking link, against the real store: the time is
// freed or taken, a second cancel is refused, and each change sends exactly
// one e-mail through the recording adapter (no provider exists). The store's
// clock is fixed so the dates are too. All data is fictional.

const run = randomUUID().slice(0, 8);
const SECRET = "synthetic-address-secret";
const CLOCK = new Date("2026-11-16T10:00:00+01:00").getTime();
const DATE = "2026-11-24";
const NEXT_DATE = "2026-11-25";

const holder = vi.hoisted(() => ({ store: undefined as unknown as import("../../src/concept/store/postgres-studio-store").PostgresStudioStore }));
vi.mock("../../src/lib/owner-store", async (importOriginal) => ({ ...(await importOriginal<object>()), ownerStore: () => holder.store }));

const mails: EmailMessage[] = [];
const registry = { resolve: async () => ({ adapter: { send: async (m: EmailMessage) => (mails.push(m), ok({ id: `m-${mails.length}`, to: [] }, "sent")) } as unknown as EmailPort, live: true, reason: "live" as const }) };
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
  const account = await createOwnerAccount({ email: `${randomUUID().slice(0, 8)}-${run}@example.test`, password: "a long fictional passphrase", salonName: `Salong Andra ${run}`, language: "en" });
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
});

afterAll(async () => {
  await db.ownerAccount.deleteMany({ where: { email: { endsWith: `-${run}@example.test` } } });
  for (const table of ["tenant_effect", "tenant_idempotency", "tenant_action", "tenant_state"])
    await db.$executeRawUnsafe(`DELETE FROM ${table} WHERE tenant_id = $1`, tenantId);
  vi.unstubAllEnvs();
  await db.$disconnect();
});

const headers = (key?: string) => {
  const ip = `10.7.${Math.floor(++calls / 250)}.${calls % 250}`;
  return { "content-type": "application/json", host: "localhost", origin: "http://localhost", "x-booking-client-ip": ip, "x-booking-client-proof": addressProof(ip, SECRET), ...(key ? { "idempotency-key": key } : {}) };
};

const book = (start: number, date = DATE, phone = `0735552${100 + ++calls}`) => BOOK(new NextRequest(`http://localhost/api/public/salons/${slug}/bookings`, {
  method: "POST", headers: headers(randomUUID()),
  body: JSON.stringify({ serviceId, staffId, date, start, name: "Lisa Berg", phone, email: "lisa@example.test", language: "en", website: "", terms, issuedAt: issuedAtToken(tenantId, slug, Date.now() - 10_000) }),
}), { params: Promise.resolve({ slug }) });

/** Books a time and returns its reference and the token of the confirmation e-mail. */
async function booked(start: number, date = DATE) {
  const before = mails.length;
  const response = await book(start, date);
  expect(response.status).toBe(201);
  const { ref } = await response.json();
  return { ref: ref as string, token: /#t=(v1\.[^\s"]+)/.exec(mails[before].text)![1] };
}

const change = (route: typeof CANCEL, ref: string, body: object, key: string = randomUUID()) => route(new NextRequest(`http://localhost/api/public/salons/${slug}/bookings/${ref}/x`, {
  method: "POST", headers: headers(key), body: JSON.stringify(body),
}), { params: Promise.resolve({ slug, id: ref }) });

const busy = async (date: string) => (await holder.store.load(tenantId))!.state.bookings.filter((b) => b.date === date && b.status === "booked").map((b) => b.start);
const drain = () => drainPendingEffects({ prisma: db as unknown as PrismaClient, sinks, tenants: [tenantId], now: async () => CLOCK });

describe("cancel by token", () => {
  it("frees the time for someone else, refuses a second cancel, and sends exactly one e-mail", async () => {
    const { ref, token } = await booked(540);
    expect(await busy(DATE)).toContain(540);
    mails.length = 0;

    const key = randomUUID();
    const response = await change(CANCEL, ref, { token }, key);
    expect(response.status).toBe(200);
    expect((await response.json()).booking).toMatchObject({ status: "cancelled" });
    expect(await busy(DATE)).not.toContain(540);
    expect(mails).toHaveLength(1);
    expect(mails[0]).toMatchObject({ to: ["lisa@example.test"], subject: expect.stringContaining("cancelled") });
    expect(mails[0].text).not.toContain("#t=");

    // A replay is the same answer and no second e-mail; a new key for the same cancel is refused.
    expect((await change(CANCEL, ref, { token }, key)).status).toBe(200);
    const again = await change(CANCEL, ref, { token });
    expect([again.status, await again.json()]).toEqual([409, { error: "not_changeable" }]);
    await drain();
    expect(mails).toHaveLength(1);

    expect((await book(540)).status).toBe(201);
  });
});

describe("move by token", () => {
  it("frees the old time, takes the new one, and sends exactly one e-mail with a fresh link", async () => {
    const { ref, token } = await booked(600);
    mails.length = 0;

    const response = await change(MOVE, ref, { token, staffId, date: NEXT_DATE, start: 660 });
    expect(response.status).toBe(200);
    expect((await response.json()).booking).toMatchObject({ date: NEXT_DATE, start: 660, status: "booked" });
    expect(await busy(DATE)).not.toContain(600);
    expect(await busy(NEXT_DATE)).toContain(660);
    expect(mails).toHaveLength(1);
    expect(mails[0].subject).toContain("moved");
    expect(mails[0].text).toMatch(/#t=v1\./);
    await drain();
    expect(mails).toHaveLength(1);

    // The new time is taken for others, and the old one can be booked.
    const taken = await booked(720, NEXT_DATE);
    const clash = await change(MOVE, taken.ref, { token: taken.token, staffId, date: NEXT_DATE, start: 660 });
    expect([clash.status, await clash.json()]).toEqual([409, { error: "slot_unavailable" }]);
    expect((await book(600)).status).toBe(201);
  });
});
