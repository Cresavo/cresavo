import { afterAll, describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { db } from "../../src/lib/db";
import { createAgentApiKey } from "../../src/lib/agent-api/keys";
import { liveSnapshot } from "../../src/lib/agent-api/live";
import { POST as book } from "../../src/app/api/v1/bookings/route";
import { GET as status } from "../../src/app/api/v1/bookings/[id]/route";
import { POST as cancel } from "../../src/app/api/v1/bookings/[id]/cancel/route";

const tag = `agent-bookings-${Date.now()}`;
const email = `${tag}@example.test`;
afterAll(async () => {
  const keys = await db.agentApiKey.findMany({ where: { agentName: { startsWith: tag } } });
  const ids = keys.map((k) => k.id);
  const links = await db.agentBooking.findMany({ where: { keyId: { in: ids } } });
  await db.agentApiEvent.deleteMany({ where: { keyId: { in: ids } } });
  await db.agentBooking.deleteMany({ where: { keyId: { in: ids } } });
  await db.booking.deleteMany({ where: { id: { in: links.map((l) => l.bookingId) } } });
  await db.agentApiKey.deleteMany({ where: { id: { in: ids } } });
  await db.$disconnect();
});
let day = DateTime.now().setZone("Europe/Stockholm").startOf("day").plus({ days: 9 });
while (day.weekday > 5) day = day.plus({ days: 1 });
const start = day.set({ hour: 14, minute: 30 }).toISO()!;

const req = (path: string, key: string, init: RequestInit = {}, idem?: string) =>
  new Request(`http://localhost${path}`, {
    ...init,
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json", ...(idem && { "idempotency-key": idem }) },
  });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const body = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    business: "demo", serviceId: "massage", serviceVersion: 1, staffId: "staff-erik", start,
    customer: { name: "Syntetisk Agentkund", email }, confirmed: true, ...over,
  });

describe("Agent API v1 bokningar mot PostgreSQL", () => {
  it("bokar, upprepar säkert, hanterar krock, skyddar andras bokningar och avbokar", async () => {
    const a = await createAgentApiKey({ businessId: "demo", agentName: `${tag}-a`, ownerName: "Ägare A", ownerContact: "a@example.test", kind: "demo-script" }, db);
    const b = await createAgentApiKey({ businessId: "demo", agentName: `${tag}-b`, ownerName: "Ägare B", ownerContact: "b@example.test" }, db);
    const readOnly = await createAgentApiKey({ businessId: "demo", agentName: `${tag}-ro`, ownerName: "Ägare C", ownerContact: "c@example.test", scopes: ["services:read"] }, db);

    expect((await book(req("/api/v1/bookings", a.key, { method: "POST", body: body() }))).status).toBe(400); // no Idempotency-Key
    expect((await (await book(req("/api/v1/bookings", a.key, { method: "POST", body: body({ confirmed: false }) }, "k0"))).json()).error.code).toBe("confirmation_required");
    expect((await (await book(req("/api/v1/bookings", a.key, { method: "POST", body: body({ customer: { name: "Riktig Person", email: "real@gmail.com" } }) }, "k0"))).json()).error.code).toBe("synthetic_contact_required");
    expect((await book(req("/api/v1/bookings", readOnly.key, { method: "POST", body: body() }, "k1"))).status).toBe(403);

    const first = await book(req("/api/v1/bookings", a.key, { method: "POST", body: body() }, "k1"));
    expect(first.status).toBe(201);
    const created = await first.json();
    expect(created.replayed).toBe(false);
    expect(created.booking).toMatchObject({ status: "confirmed", serviceId: "massage", durationMinutes: 30, staff: { id: "staff-erik", name: "Erik" } });
    expect(created.booking.start).toBe(DateTime.fromISO(start).setZone("Europe/Stockholm").toISO({ suppressMilliseconds: true }));
    expect(JSON.stringify(created)).not.toContain(email);

    const replay = await book(req("/api/v1/bookings", a.key, { method: "POST", body: body() }, "k1"));
    expect(replay.status).toBe(200);
    expect((await replay.json()).booking.id).toBe(created.booking.id);

    const conflict = await book(req("/api/v1/bookings", b.key, { method: "POST", body: body() }, "k1"));
    expect(conflict.status).toBe(409);
    expect((await conflict.json()).error.code).toBe("slot_unavailable");

    const mismatch = await book(req("/api/v1/bookings", a.key, { method: "POST", body: body({ serviceVersion: 99 }) }, "k2"));
    expect((await mismatch.json()).error.code).toBe("stale_service");

    const id = created.booking.id;
    expect((await status(req(`/api/v1/bookings/${id}`, b.key), ctx(id))).status).toBe(404);
    expect((await cancel(req(`/api/v1/bookings/${id}/cancel`, b.key, { method: "POST" }), ctx(id))).status).toBe(404);
    expect((await status(req(`/api/v1/bookings/${id}`, a.key), ctx(id))).status).toBe(200);

    const c1 = await (await cancel(req(`/api/v1/bookings/${id}/cancel`, a.key, { method: "POST" }), ctx(id))).json();
    expect(c1).toMatchObject({ alreadyCancelled: false, booking: { status: "cancelled" } });
    const c2 = await (await cancel(req(`/api/v1/bookings/${id}/cancel`, a.key, { method: "POST" }), ctx(id))).json();
    expect(c2.alreadyCancelled).toBe(true);

    const events = await db.bookingEvent.findMany({ where: { bookingId: id }, orderBy: { createdAt: "asc" } });
    expect(events.map((e) => [e.action, e.actorKind, e.actorId])).toEqual([
      ["create", "agent-api", a.record.id],
      ["cancel", "agent-api", a.record.id],
    ]);

    const live = await liveSnapshot(100);
    const mine = live.events.filter((e) => e.agentName.startsWith(tag));
    expect(mine.map((e) => e.outcome).sort()).toEqual(["booked", "cancelled", "conflict", "replayed", "stale_service"]);
    expect(mine.find((e) => e.agentName === `${tag}-a`)?.provenance).toBe("demo-script");
    const text = JSON.stringify(live);
    for (const secret of [email, "a@example.test", "Ägare A", a.key, a.record.keyPrefix]) expect(text).not.toContain(secret);
  });
});
