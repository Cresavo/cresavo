import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { DateTime } from "luxon";
import { db } from "../../src/lib/db";
import { createAgentApiKey } from "../../src/lib/agent-api/keys";
import { handleMcp } from "../../src/lib/agent-api/mcp";
import { POST as bookings } from "../../src/app/api/v1/bookings/route";
import { GET as booking } from "../../src/app/api/v1/bookings/[id]/route";
import { POST as cancel } from "../../src/app/api/v1/bookings/[id]/cancel/route";
import { addressProof } from "../../scripts/client-address.mjs";
import { cleanupRun, grant } from "../../scripts/agentprov/fixtures.mjs";
import { rpcBody } from "../helpers/oauth";

// ADR 7 / issue #181: the app's MCP carries the gateway's transport controls itself.
vi.unmock("../../src/lib/agent-api/address-limits");

const run = `agentprov-${randomUUID()}`;
const secret = "synthetic-transport-address-proof";
const origin = "http://127.0.0.1:3241";
let key: string, clientId: string;
let nextAddress = 10;

beforeAll(async () => {
  const k = await createAgentApiKey({ businessId: "demo", agentName: `${run}-a`, ownerName: "Synthetic operator",
    ownerContact: "operator@example.test", kind: "demo-script" }, db);
  key = k.key; clientId = k.record.clientId;
});
beforeEach(() => {
  vi.stubEnv("BOOKING_ADDRESS_SECRET", secret); vi.stubEnv("BOOKING_PUBLIC_ORIGIN", origin);
  vi.stubEnv("BOOKING_RUNTIME", "local");
});
afterEach(() => { vi.unstubAllEnvs(); });
afterAll(async () => { await cleanupRun(run); await db.$disconnect(); });

// A fresh signed client address per test, as the supported server wrapper sends it.
function address() {
  const ip = `198.51.100.${nextAddress++}`;
  return { "x-booking-client-ip": ip, "x-booking-client-proof": addressProof(ip, secret) };
}
function mcp(body: string, headers: Record<string, string> = {}) {
  return handleMcp(new Request("http://localhost/api/v1/mcp", { method: "POST", body,
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...headers } }));
}
const call = (name: string, args: Record<string, unknown>, id = 1) =>
  JSON.stringify({ jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } });
const bookingArgs = (mandateId = "m-" + randomUUID()) => ({ business: "demo", serviceId: "massage", serviceVersion: 1,
  staffId: "staff-demo", start: DateTime.now().plus({ days: 5 }).toISO()!, confirmed: true, mandateId,
  customer: { name: "Synthetic transport customer", email: `${run}@example.test` } });
async function errorCode(response: Response) {
  return { status: response.status, code: (await response.json()).error?.code };
}
async function toolResult(response: Response) {
  expect(response.status).toBe(200);
  const result = (await rpcBody(response)).result;
  return { isError: result.isError === true, body: JSON.parse(result.content[0].text) };
}

describe("per client address budgets", () => {
  it("allows 60 requests a minute per address, counted before authentication", async () => {
    const from = address();
    for (let i = 0; i < 60; i++) expect((await mcp(call("list_services", { business: "demo" }), from)).status).toBe(401);
    expect(await errorCode(await mcp(call("list_services", { business: "demo" }), from))).toEqual({ status: 429, code: "rate_limited" });
    expect((await mcp(call("list_services", { business: "demo" }), address())).status).toBe(401);
  });

  it("allows 5 booking creates an hour per address across MCP and REST", async () => {
    const from = address(), auth = { authorization: `Bearer ${key}` };
    for (let i = 0; i < 3; i++)
      expect((await toolResult(await mcp(call("create_booking", { ...bookingArgs(), idempotencyKey: randomUUID() }), { ...from, ...auth }))).body.error.code)
        .toBe("mandate_denied");
    for (let i = 0; i < 2; i++)
      expect((await bookings(new Request("http://localhost/api/v1/bookings", { method: "POST", body: JSON.stringify(bookingArgs()),
        headers: { ...from, ...auth, "content-type": "application/json", "idempotency-key": randomUUID() } }))).status).toBe(403);
    expect(await errorCode(await mcp(call("usp_bookings_create", { ...bookingArgs(), idempotencyKey: randomUUID() }), { ...from, ...auth })))
      .toEqual({ status: 429, code: "rate_limited" });
    // Reads from the same address still pass; another address still books.
    expect((await toolResult(await mcp(call("list_services", { business: "demo" }), { ...from, ...auth }))).isError).toBe(false);
    expect((await toolResult(await mcp(call("create_booking", { ...bookingArgs(), idempotencyKey: randomUUID() }), { ...address(), ...auth }))).body.error.code)
      .toBe("mandate_denied");
  });

  it("allows 5 proposal creates an hour per address", async () => {
    const from = { ...address(), authorization: `Bearer ${key}` };
    const proposal = { business: "demo", serviceId: "massage", serviceVersion: 1, staffId: "staff-demo", start: bookingArgs().start };
    for (let i = 0; i < 5; i++) expect((await mcp(call("create_proposal", proposal), from)).status).toBe(200);
    expect(await errorCode(await mcp(call("create_proposal", proposal), from))).toEqual({ status: 429, code: "rate_limited" });
  });
});

describe("one message, own origin", () => {
  const auth = () => ({ ...address(), authorization: `Bearer ${key}` });

  it("refuses a browser origin other than the public origin", async () => {
    expect(await errorCode(await mcp(call("list_services", { business: "demo" }), { ...auth(), origin: "https://attacker.example" })))
      .toEqual({ status: 403, code: "forbidden_origin" });
    expect((await toolResult(await mcp(call("list_services", { business: "demo" }), { ...auth(), origin }))).isError).toBe(false);
  });

  it("refuses JSON-RPC batches, invalid JSON and oversized bodies before authentication", async () => {
    const batch = `[${call("list_services", { business: "demo" })},${call("cancel_booking", { bookingId: "x" }, 2)}]`;
    for (const body of [batch, "{", "null", "x".repeat(70 * 1024)])
      expect(await errorCode(await mcp(body, address()))).toEqual({ status: 400, code: "invalid_request" });
  });

  it("accepts a byte order mark and forwards the same parsed message", async () => {
    const result = await toolResult(await mcp("﻿" + call("list_services", { business: "demo" }), auth()));
    expect(result.body.services.length).toBeGreaterThan(0);
  });

  it("never treats an admin session cookie as an agent credential", async () => {
    const cookie = { ...address(), cookie: `booking_admin=${randomUUID()}.${"a".repeat(64)}` };
    expect(await errorCode(await mcp(call("list_services", { business: "demo" }), cookie))).toEqual({ status: 401, code: "unauthorized" });
    const rest = await bookings(new Request("http://localhost/api/v1/bookings", { method: "POST", body: JSON.stringify(bookingArgs()),
      headers: { ...cookie, "content-type": "application/json", "idempotency-key": randomUUID() } }));
    expect(await errorCode(rest)).toEqual({ status: 401, code: "unauthorized" });
  });
});

describe("no direct cancellation", () => {
  it("refuses the owner's own booking on both transports and leaves it confirmed", async () => {
    const auth = { ...address(), authorization: `Bearer ${key}` };
    let slot;
    for (let d = 3; d < 14 && !slot; d++) {
      const date = DateTime.now().setZone("Europe/Stockholm").plus({ days: d }).toISODate();
      slot = (await toolResult(await mcp(call("get_availability", { business: "demo", service: "massage", date }), auth))).body.slots[0];
    }
    const mandate = await grant(clientId, slot, 45000, run);
    const created = await toolResult(await mcp(call("create_booking", { ...bookingArgs(mandate.id), staffId: slot.staff.id,
      start: slot.start, idempotencyKey: randomUUID() }), auth));
    const id = created.body.booking.id as string;
    expect((await toolResult(await mcp(call("cancel_booking", { bookingId: id }), auth))).body.error.code).toBe("mandate_denied");
    const ctx = { params: Promise.resolve({ id }) };
    const rest = await cancel(new Request(`http://localhost/api/v1/bookings/${id}/cancel`, { method: "POST", headers: auth }), ctx);
    expect(await errorCode(rest)).toEqual({ status: 403, code: "mandate_denied" });
    const read = await booking(new Request(`http://localhost/api/v1/bookings/${id}`, { headers: auth }), ctx);
    expect((await read.json()).booking.status).toBe("confirmed");
  }, 30000);
});
