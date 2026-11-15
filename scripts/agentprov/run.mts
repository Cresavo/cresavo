// Local-only acceptance coordinator. No .env loading, credentials stay in memory.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { DateTime } from "luxon";
import { assertTestDatabase } from "../test-db-guard.mjs";
import { db } from "../../src/lib/db";
import { createAgentApiKey, rotateAgentApiKey } from "../../src/lib/agent-api/keys";
import { cleanupRun, grant } from "./fixtures.mjs";

// Guard before the first query or child process. Hosted DBs are never test DBs.
assertTestDatabase();
const base = new URL(process.env.AGENTPROV_BASE_URL ?? "http://127.0.0.1:3217");
assert(["127.0.0.1", "localhost", "[::1]"].includes(base.hostname) && base.protocol === "http:", "PROOF_TARGET_REFUSED");
assert(!process.env.VERCEL && !process.env.VERCEL_ENV, "PROOF_CLOUD_REFUSED");
if (process.argv[2] === "--reset-run") {
  try { await cleanupRun(process.argv[3]); console.log("PROOF_RESET_COMPLETE"); }
  finally { await db.$disconnect(); }
  process.exit(0);
}

type Slot = { start: string; end: string; serviceId: string; durationMinutes: number; staff: { id: string } };
type Service = { id: string; version: number; price: { amountMinor: number }; staff: { id: string }[] };
// Wire fields are checked in the assertions; malformed/error replies fail the run.
type Reply = { status?: number; isError?: boolean; body: {
  services: Service[]; slots: Slot[]; booking: { id: string; status: string };
  error: { code: string }; replayed: boolean;
} };
class Worker {
  private sequence = 0;
  private pending = new Map<number, { resolve: (r: Reply) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }>();
  private child;
  constructor(mode: "rest" | "mcp", key: string) {
    this.child = spawn(process.execPath, ["--import", "tsx", `scripts/agentprov/${mode}-client.mts`], {
      env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, NODE_ENV: "test",
        AGENTPROV_BASE_URL: base.href, AGENTPROV_KEY: key },
      stdio: ["pipe", "pipe", "ignore"],
    });
    const fail = () => {
      for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(new Error("PROOF_CLIENT_FAILED")); }
      this.pending.clear();
    };
    this.child.on("error", fail).on("exit", fail);
    createInterface({ input: this.child.stdout }).on("line", line => {
      try {
        const r = JSON.parse(line), p = this.pending.get(r.id);
        if (!p || r.failure) { fail(); return; }
        clearTimeout(p.timer); this.pending.delete(r.id); p.resolve(r);
      } catch { fail(); }
    });
  }
  call(input: Record<string, unknown>): Promise<Reply> {
    return new Promise((resolve, reject) => {
      const id = ++this.sequence;
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error("PROOF_CLIENT_TIMEOUT")); }, 35000);
      this.pending.set(id, { resolve, reject, timer });
      this.child.stdin.write(JSON.stringify({ id, ...input }) + "\n");
    });
  }
  close() { this.child.stdin.end(); this.child.kill(); }
}

const run = `agentprov-${randomUUID()}`;
const workers: Worker[] = [];
const worker = (mode: "rest" | "mcp", key: string) => { const w = new Worker(mode, key); workers.push(w); return w; };
const rest = (w: Worker, method: string, path: string, body?: unknown, idempotencyKey?: string) => w.call({ method, path, body, idempotencyKey });
const mcp = (w: Worker, name: string, args: Record<string, unknown>) => w.call({ name, args });
const pass = (code: string) => console.log(`PASS ${code}`);
let step = "PROVISION_CLIENTS";
try {
  console.log(`PROOF_RUN ${run}`);
  const make = (suffix: string) => createAgentApiKey({ businessId: "demo", agentName: `${run}-${suffix}`,
    ownerName: "Synthetic operator", ownerContact: "operator@example.test", kind: "demo-script" }, db);
  const a = await make("rest"), b = await make("mcp");
  const wa = worker("rest", a.key), wb = worker("mcp", b.key);
  step = "CONNECT_AND_LIST_SERVICES";
  const servicesA = await rest(wa, "GET", "/api/v1/services?business=demo");
  const servicesB = await mcp(wb, "list_services", { business: "demo" });
  assert.equal(servicesA.status, 200); assert.equal(servicesB.isError, false);
  const service = servicesA.body.services.find((s: { id: string }) => s.id === "massage");
  assert(service); assert.deepEqual(servicesA.body.services, servicesB.body.services);
  step = "FIND_AVAILABLE_SLOTS";
  const slots: Slot[] = [];
  for (let d = 1; d <= 14 && slots.length < 3; d++) {
    const date = DateTime.now().setZone("Europe/Stockholm").plus({ days: d }).toISODate();
    const r = await rest(wa, "GET", `/api/v1/availability?business=demo&service=massage&date=${date}`);
    assert.equal(r.status, 200);
    // Non-overlapping slots; one staff per day, no buffer/length assumptions.
    const last = slots.at(-1);
    for (const s of r.body.slots) {
      if (s.staff.id !== service.staff[0].id || (last && s.start <= last.end)) continue;
      const previous = slots.at(-1);
      if (!previous || s.start >= previous.end) slots.push(s);
      if (slots.length === 3) break;
    }
  }
  assert.equal(slots.length, 3, "PROOF_NEEDS_THREE_SLOTS");
  step = "REST_CREATE_RETRY_STATUS";
  const payload = async (clientId: string, slot: Slot, suffix: string) => ({
    business: "demo", serviceId: service.id, serviceVersion: service.version,
    staffId: slot.staff.id, start: slot.start, confirmed: true,
    customer: { name: "Synthetic Agentprov", email: `${run}-${suffix}@example.test` },
    mandateId: (await grant(clientId, slot, service.price.amountMinor, run)).id,
  });
  const pa = await payload(a.record.clientId, slots[0], "a"), ia = randomUUID();
  const firstA = await rest(wa, "POST", "/api/v1/bookings", pa, ia);
  assert.equal(firstA.status, 201); assert.equal(firstA.body.booking.status, "confirmed");
  const replayA = await rest(wa, "POST", "/api/v1/bookings", pa, ia);
  assert.equal(replayA.status, 200); assert.equal(replayA.body.booking.id, firstA.body.booking.id);
  assert.equal((await rest(wa, "GET", `/api/v1/bookings/${firstA.body.booking.id}`)).body.booking.status, "confirmed");
  pass("REST_CREATE_RETRY_STATUS");
  step = "CROSS_CLIENT_READ_AND_REPLAY";
  assert.equal((await mcp(wb, "get_booking", { bookingId: firstA.body.booking.id })).body.error.code, "booking_not_found");
  assert.equal((await mcp(wb, "create_booking", { ...pa, idempotencyKey: ia })).body.error.code, "mandate_denied");
  pass("CROSS_CLIENT_READ_AND_REPLAY_DENIED");
  step = "HTTP_MCP_CREATE_RETRY_STATUS";
  const pb = await payload(b.record.clientId, slots[1], "b"), ib = randomUUID();
  const firstB = await mcp(wb, "create_booking", { ...pb, idempotencyKey: ib });
  assert.equal(firstB.isError, false); assert.equal(firstB.body.booking.status, "confirmed");
  const replayB = await mcp(wb, "create_booking", { ...pb, idempotencyKey: ib });
  assert.equal(replayB.body.booking.id, firstB.body.booking.id); assert.equal(replayB.body.replayed, true);
  assert.equal((await mcp(wb, "get_booking", { bookingId: firstB.body.booking.id })).body.booking.status, "confirmed");
  assert.equal((await rest(wa, "GET", `/api/v1/bookings/${firstB.body.booking.id}`)).status, 404);
  pass("HTTP_MCP_CREATE_RETRY_STATUS");
  step = "CONCURRENT_CONFLICT";
  const raceA = await payload(a.record.clientId, slots[2], "race-a");
  const raceB = await payload(b.record.clientId, slots[2], "race-b");
  const race = await Promise.all([
    rest(wa, "POST", "/api/v1/bookings", raceA, randomUUID()),
    mcp(wb, "create_booking", { ...raceB, idempotencyKey: randomUUID() }),
  ]);
  assert.equal(race.filter(r => r.body.booking?.id).length, 1);
  assert.equal(race.filter(r => r.body.error?.code === "slot_unavailable").length, 1);
  if (race[0].body.error) assert.equal(race[0].status, 409);
  assert.equal(await db.booking.count({ where: { businessId: "demo", staffId: slots[2].staff.id,
    startsAt: new Date(slots[2].start), status: "confirmed" } }), 1);
  pass("TWO_TRANSPORTS_ONE_WINNER_ONE_CONTROLLED_CONFLICT");
  step = "ROTATION_OWNERSHIP_IDEMPOTENCY";
  const rotated = await rotateAgentApiKey(a.record.id, db);
  const wa2 = worker("rest", rotated.key);
  assert.equal(rotated.record.clientId, a.record.clientId);
  assert.equal((await rest(wa, "GET", `/api/v1/bookings/${firstA.body.booking.id}`)).status, 401);
  assert.equal((await rest(wa2, "GET", `/api/v1/bookings/${firstA.body.booking.id}`)).status, 200);
  const again = await rest(wa2, "POST", "/api/v1/bookings", pa, ia);
  assert.equal(again.status, 200); assert.equal(again.body.booking.id, firstA.body.booking.id);
  pass("ROTATION_PRESERVES_OWNERSHIP_AND_IDEMPOTENCY");
  assert.equal(await db.customer.count({ where: { email: { startsWith: run } } }), 0);
  pass("NO_CUSTOMER_PROFILES_CREATED");
} catch {
  // Step is a static internal code, never a response, URL, key or exception dump.
  console.error(`FAIL ${step}`); process.exitCode = 1;
} finally {
  for (const w of workers) w.close();
  try { await cleanupRun(run); console.log("PASS OWN_SYNTHETIC_FIXTURES_REMOVED"); }
  catch { console.error("FAIL PROOF_CLEANUP_FAILED"); process.exitCode = 1; }
  await db.$disconnect();
}
