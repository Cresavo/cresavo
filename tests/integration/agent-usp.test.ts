import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { db } from "../../src/lib/db";
import { createAgentApiKey } from "../../src/lib/agent-api/keys";
import { handleMcp } from "../../src/lib/agent-api/mcp";
import { uspAliases } from "../../src/lib/agent-api/mcp-inputs";
import { POST as book } from "../../src/app/api/v1/bookings/route";
import { cleanupRun, grant } from "../../scripts/agentprov/fixtures.mjs";

const run = `agentprov-${randomUUID()}`;
const clients: Client[] = [];
type Credential = Awaited<ReturnType<typeof createAgentApiKey>>;
let a: Credential, b: Credential, readOnly: Credential;
let ca: Client, cb: Client, cr: Client;
type Slot = { start: string; serviceId: string; durationMinutes: number; staff: { id: string }; locationId: string; scheduleId: string };
async function connect(key: string) {
  const client = new Client({ name: "synthetic-alias-contract-test", version: "1" });
  clients.push(client);
  await client.connect(new StreamableHTTPClientTransport(new URL("http://localhost/api/v1/mcp"), {
    requestInit: { headers: { authorization: `Bearer ${key}` } },
    // Real SDK and HTTP request/response handler, in-process bridge, not a socket/browser test.
    fetch: async (input, init) => {
      const request = new Request(input, init);
      if (new URL(request.url).pathname !== "/api/v1/mcp") throw new Error("TEST_TARGET_REFUSED");
      return handleMcp(request);
    },
  }));
  return client;
}
const call = (client: Client, name: string, args: Record<string, unknown>) => client.callTool({ name, arguments: args });
function payload(result: Awaited<ReturnType<typeof call>>) {
  const block = result.content.find(c => c.type === "text");
  if (!block || block.type !== "text") throw new Error("TEST_RESULT_MISSING");
  return JSON.parse(block.text);
}
beforeAll(async () => {
  const make = (suffix: string, scopes?: string[]) => createAgentApiKey({ businessId: "demo", agentName: `${run}-${suffix}`,
    ownerName: "Synthetic operator", ownerContact: "operator@example.test", kind: "demo-script", ...(scopes && { scopes }) }, db);
  a = await make("a"); b = await make("b"); readOnly = await make("read", ["services:read"]);
  ca = await connect(a.key); cb = await connect(b.key); cr = await connect(readOnly.key);
});
afterAll(async () => {
  for (const client of clients) await client.close();
  await cleanupRun(run);
  await db.$disconnect();
});

async function availableSlot(): Promise<Slot> {
  for (let d = 3; d < 14; d++) {
    const date = DateTime.now().setZone("Europe/Stockholm").plus({ days: d }).toISODate();
    const result = await call(ca, "usp_availability_query", { business: "demo", service: "massage", date });
    expect(result.isError).not.toBeTruthy();
    const slot = payload(result).slots[0];
    if (slot) return slot;
  }
  throw new Error("TEST_SLOT_MISSING");
}
function bookingArgs(slot: Slot, mandateId: string) {
  return { business: "demo", serviceId: "massage", serviceVersion: 1, staffId: slot.staff.id,
    start: slot.start, confirmed: true, mandateId, idempotencyKey: randomUUID(),
    customer: { name: "Synthetic alias customer", email: `${run}@example.test` } };
}

describe("USP aliases preserve native authority and business logic", () => {
  it("lists five aliases alongside old tools and reads the same authorised catalog", async () => {
    const { tools } = await ca.listTools();
    const names = tools.map(t => t.name);
    expect(names).toEqual(expect.arrayContaining([...Object.keys(uspAliases), "list_services", "get_availability", "create_booking", "get_booking", "cancel_booking"]));
    expect(names).not.toContain("list_bookings");
    expect(names).not.toContain("create_campaign_draft");
    for (const [alias, native] of Object.entries(uspAliases).filter(([, native]) => native !== "get_service"))
      expect(tools.find(t => t.name === alias)?.inputSchema).toEqual(tools.find(t => t.name === native)?.inputSchema);
    const native = payload(await call(ca, "list_services", { business: "demo" }));
    expect(payload(await call(ca, "usp_services_list", { business: "demo" }))).toEqual(native);
    expect(payload(await call(ca, "usp_services_get", { business: "demo", service: "massage" })).service)
      .toEqual(native.services.find((s: { id: string }) => s.id === "massage"));
    expect(payload(await call(ca, "usp_services_get", { business: "other", service: "massage" })).error.code).toBe("forbidden_business");
    expect(payload(await call(ca, "usp_services_get", { business: "demo", service: "missing" })).error.code).toBe("service_not_found");
  });

  it("aliases retain scope checks and never accept client JSON as a wider mandate", async () => {
    const slot = await availableSlot();
    const stored = await grant(a.record.clientId, slot, 45000, run);
    expect(stored.locationId).toBe(slot.locationId);
    expect(stored.scheduleId).toBe(slot.scheduleId);
    const args = bookingArgs(slot, stored.id);
    expect(payload(await call(cr, "usp_bookings_create", args)).error.code).toBe("forbidden_scope");
    expect((await call(ca, "usp_bookings_create", { ...args, mandate: { locationId: "anywhere", maxPriceOre: 999999 } })).isError).toBe(true);
    const { idempotencyKey, mandateId: _unused, ...body } = args;
    void _unused;
    const response = await book(new Request("http://localhost/api/v1/bookings", {
      method: "POST", headers: { authorization: `Bearer ${a.key}`, "content-type": "application/json", "idempotency-key": idempotencyKey },
      body: JSON.stringify({ ...body, buyer: { consent: true }, mandate: { locationId: "anywhere" } }),
    }));
    expect(response.status).toBe(400);
    expect(await db.agentBooking.count({ where: { clientId: a.record.clientId } })).toBe(0);
  });

  it("checks stored place, schedule, treatment, provider, window and current price before either transport can create", async () => {
    const slot = await availableSlot();
    const stored = await grant(a.record.clientId, slot, 45000, run);
    const original = { locationId: stored.locationId, scheduleId: stored.scheduleId,
      staffId: stored.staffId, serviceId: stored.serviceId, validUntil: stored.validUntil, maxPriceOre: stored.maxPriceOre };
    for (const change of [{ locationId: "other-location" }, { scheduleId: "other-schedule" },
      { serviceId: "fotvard" }, { staffId: "other-provider" }, { maxPriceOre: 44999 },
      { validUntil: new Date(Date.parse(slot.start) + 29 * 60000) }]) {
      await db.agentMandate.update({ where: { id: stored.id }, data: { ...original, ...change } });
      const args = bookingArgs(slot, stored.id);
      expect(payload(await call(ca, "usp_bookings_create", args)).error.code).toBe("mandate_denied");
      const { idempotencyKey, ...body } = args;
      const response = await book(new Request("http://localhost/api/v1/bookings", {
        method: "POST", headers: { authorization: `Bearer ${a.key}`, "content-type": "application/json", "idempotency-key": idempotencyKey }, body: JSON.stringify(body),
      }));
      expect(response.status).toBe(403);
    }
    expect(await db.agentBooking.count({ where: { mandateId: stored.id } })).toBe(0);
  }, 30000);

  it("old and alias creates share idempotency, owned status and conflicts", async () => {
    const slot = await availableSlot();
    const ma = await grant(a.record.clientId, slot, 45000, run), mb = await grant(b.record.clientId, slot, 45000, run);
    const args = bookingArgs(slot, ma.id);
    const first = payload(await call(ca, "usp_bookings_create", args));
    expect(first.replayed).toBe(false);
    expect(first.booking.status).toBe("confirmed");
    expect(first.booking.locationId).toBe(slot.locationId);
    expect(first.booking.scheduleId).toBe(slot.scheduleId);
    expect(payload(await call(ca, "create_booking", args)).booking.id).toBe(first.booking.id);
    expect(payload(await call(ca, "get_booking", { bookingId: first.booking.id })))
      .toEqual(payload(await call(ca, "usp_bookings_get", { bookingId: first.booking.id })));
    expect(payload(await call(cb, "usp_bookings_get", { bookingId: first.booking.id })).error.code).toBe("booking_not_found");
    expect(payload(await call(cb, "usp_bookings_create", bookingArgs(slot, mb.id))).error.code).toBe("slot_unavailable");
    expect(await db.agentBooking.count({ where: { mandateId: ma.id } })).toBe(1);
    expect(await db.agentBooking.count({ where: { mandateId: mb.id } })).toBe(0);
  }, 30000);
});
