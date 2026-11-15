import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { db } from "../../src/lib/db";
import { getAvailability } from "../../src/lib/domain";
import { createAgentApiKey, rotateAgentApiKey } from "../../src/lib/agent-api/keys";
import { POST as book } from "../../src/app/api/v1/bookings/route";
import { GET as status } from "../../src/app/api/v1/bookings/[id]/route";
import { cleanupRun, grant } from "../../scripts/agentprov/fixtures.mjs";

const run = `agentprov-${randomUUID()}`;
afterEach(() => cleanupRun(run));
const key = (name: string) => createAgentApiKey({ businessId: "demo", agentName: `${run}-${name}`,
  ownerName: "Synthetic operator", ownerContact: "operator@example.test", kind: "demo-script" }, db);
async function setup() {
  const a = await key("a"), b = await key("b");
  const service = await db.service.findUniqueOrThrow({ where: { id: "massage" } });
  let start: string | undefined;
  for (let d = 3; d < 14 && !start; d++) {
    const day = DateTime.now().setZone("Europe/Stockholm").plus({ days: d }).toISODate()!;
    start = (await getAvailability(service.id, day, db, "staff-erik"))[0];
  }
  if (!start) throw new Error("PROOF_SLOT_MISSING");
  const slot = { start, serviceId: service.id, staff: { id: "staff-erik" }, durationMinutes: service.duration };
  const ma = await grant(a.record.clientId, slot, service.priceOre, run);
  const mb = await grant(b.record.clientId, slot, service.priceOre, run);
  const body = { business: "demo", serviceId: service.id, serviceVersion: service.version,
    staffId: slot.staff.id, start, confirmed: true, mandateId: ma.id,
    customer: { name: "Synthetic proof", email: `${run}@example.test` } };
  return { a, b, ma, mb, body };
}
const post = (key: string, body: unknown, idempotencyKey: string) => book(new Request("http://localhost/api/v1/bookings", {
  method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "idempotency-key": idempotencyKey },
  body: JSON.stringify(body),
}));
const read = (key: string, id: string) => status(new Request(`http://localhost/api/v1/bookings/${id}`, {
  headers: { authorization: `Bearer ${key}` },
}), { params: Promise.resolve({ id }) });

describe("Agentprov 1 server contract", () => {
  it("20 retries create one linked booking and rotation retains ownership", async () => {
    const { a, b, ma, body } = await setup();
    const results = await Promise.all(Array.from({ length: 20 }, () => post(a.key, body, "parallel")));
    expect(results.filter(r => r.status === 201)).toHaveLength(1);
    expect(results.filter(r => r.status === 200)).toHaveLength(19);
    const bodies = await Promise.all(results.map(r => r.json()));
    const id = bodies[0].booking.id;
    expect(new Set(bodies.map(r => r.booking.id)).size).toBe(1);
    expect(await db.agentBooking.count({ where: { mandateId: ma.id } })).toBe(1);
    expect((await db.booking.findUniqueOrThrow({ where: { id } })).customerId).toBeNull();
    expect((await read(b.key, id)).status).toBe(404);
    expect((await post(b.key, body, "parallel")).status).toBe(403);
    expect((await post(a.key, { ...body, customer: { ...body.customer, name: "Changed payload" } }, "parallel")).status).toBe(409);
    const rotated = await rotateAgentApiKey(a.record.id, db);
    expect(rotated.record.clientId).toBe(a.record.clientId);
    expect((await read(a.key, id)).status).toBe(401);
    expect((await read(rotated.key, id)).status).toBe(200);
    const replay = await post(rotated.key, body, "parallel");
    expect(replay.status).toBe(200);
    expect((await replay.json()).booking.id).toBe(id);
  }, 60000);

  it("separate clients contest one slot with one controlled conflict", async () => {
    const { a, b, mb, body } = await setup();
    const results = await Promise.all([post(a.key, body, "race"), post(b.key, { ...body, mandateId: mb.id }, "race")]);
    expect(results.map(r => r.status).sort()).toEqual([201, 409]);
    const loser = results.find(r => r.status === 409)!;
    expect((await loser.json()).error.code).toBe("slot_unavailable");
    expect(await db.booking.count({ where: { startsAt: new Date(body.start), staffId: body.staffId, status: "confirmed" } })).toBe(1);
    const overlap = await db.$queryRaw<{ count: bigint }[]>`SELECT count(*) FROM "Booking" a JOIN "Booking" b
      ON a."id" < b."id" AND a."businessId"=b."businessId" AND a."staffId"=b."staffId"
      AND a."status"='confirmed' AND b."status"='confirmed'
      AND tstzrange(a."startsAt",a."endsAt",'[)') && tstzrange(b."startsAt",b."endsAt",'[)')`;
    expect(Number(overlap[0].count)).toBe(0);
  });

  it("confirmed is insufficient: rejects missing, foreign, expired and revoked mandates", async () => {
    const { a, b, ma, body } = await setup();
    const { mandateId: _unused, ...missing } = body;
    void _unused;
    expect((await post(a.key, missing, "missing")).status).toBe(400);
    expect((await post(b.key, body, "foreign")).status).toBe(403);
    expect((await post(a.key, { ...body, business: "another-salon" }, "business")).status).toBe(403);
    expect((await post(a.key, { ...body, mandateId: "invented" }, "invented")).status).toBe(403);
    await db.agentMandate.update({ where: { id: ma.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await post(a.key, body, "expired")).status).toBe(403);
    await db.agentMandate.update({ where: { id: ma.id }, data: { expiresAt: new Date(Date.now() + 600000), revokedAt: new Date() } });
    expect((await post(a.key, body, "revoked")).status).toBe(403);
    expect(await db.agentBooking.count({ where: { clientId: a.record.clientId } })).toBe(0);
  });

  it("a link write failure rolls back the booking, event and mandate use", async () => {
    const { a, ma, body } = await setup();
    // Generated UUID only; never an API input in this DDL. Isolated test DB guard is mandatory.
    expect(a.record.clientId).toMatch(/^[a-f0-9-]{36}$/);
    await db.$executeRawUnsafe(`ALTER TABLE "AgentBooking" ADD CONSTRAINT "agentprov_force_failure" CHECK ("clientId" <> '${a.record.clientId}') NOT VALID`);
    try {
      expect((await post(a.key, body, "rollback")).status).toBe(500);
      expect(await db.booking.count({ where: { customerEmail: body.customer.email } })).toBe(0);
      expect(await db.agentBooking.count({ where: { mandateId: ma.id } })).toBe(0);
      expect(await db.bookingEvent.count({ where: { actorKind: "agent-api", actorId: a.record.clientId } })).toBe(0);
    } finally {
      await db.$executeRawUnsafe('ALTER TABLE "AgentBooking" DROP CONSTRAINT "agentprov_force_failure"');
    }
    expect((await post(a.key, body, "rollback")).status).toBe(201);
  });
});
