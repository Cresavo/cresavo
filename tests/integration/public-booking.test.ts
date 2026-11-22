import { randomBytes, randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { POST } from "../../src/app/api/public/salons/[slug]/bookings/route";
import { addressProof } from "../../scripts/client-address.mjs";
import { db } from "../../src/lib/db";
import { createOwnerAccount } from "../../src/lib/owner-accounts";
import { issuedAtToken } from "../../src/lib/public-issued-at";
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
});

afterAll(async () => {
  await db.ownerAccount.deleteMany({ where: { email: { endsWith: `-${run}@example.test` } } });
  for (const table of ["tenant_effect", "tenant_idempotency", "tenant_action", "tenant_state"])
    await db.$executeRawUnsafe(`DELETE FROM ${table} WHERE tenant_id = $1`, tenantId);
  vi.unstubAllEnvs();
  await db.$disconnect();
});

/** A request from a fresh address (the limit is per address) and a fresh number (the cap is per number), 10 seconds after its page was served. */
function book(over: Record<string, unknown> = {}, key: string = randomUUID()) {
  const ip = `10.7.${Math.floor(++calls / 250)}.${calls % 250}`;
  const body = {
    serviceId, staffId, date: DATE, start: 600, name: "Lisa Berg", phone: `0735550${100 + (calls % 800)}`, email: "lisa@example.test", language: "en", website: "",
    issuedAt: issuedAtToken(slug, Date.now() - 10_000), ...over,
  };
  return POST(new NextRequest(`http://localhost/api/public/salons/${slug}/bookings`, {
    method: "POST", body: JSON.stringify(body),
    headers: { "content-type": "application/json", host: "localhost", origin: "http://localhost", "idempotency-key": key, "x-booking-client-ip": ip, "x-booking-client-proof": addressProof(ip, SECRET) },
  }), { params: Promise.resolve({ slug }) });
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
    expect(stored[0].id).toBe(winner.bookingId);
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
});
