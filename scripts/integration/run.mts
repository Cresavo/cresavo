// Synthetic, loopback-only cross-repository acceptance. No .env loading.
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DateTime } from "luxon";
import { assertTestDatabase } from "../test-db-guard.mjs";

assertTestDatabase();
assert(!process.env.VERCEL && !process.env.VERCEL_ENV, "PAIR_CLOUD_REFUSED");
const nativeCodex = process.argv.includes("--native-codex");
if (nativeCodex) assert(!process.env.CI, "NATIVE_CLIENT_CI_REFUSED");
const salonPath = realpathSync(fileURLToPath(new URL("../..", import.meta.url)));
const gatewayPath = realpathSync(resolve(process.env.GATEWAY_PATH ?? "../booking-lab-gateway"));
assert.notEqual(gatewayPath, salonPath, "PAIR_REQUIRES_SEPARATE_REPOSITORIES");
for (const dir of [salonPath, gatewayPath]) {
  for (const name of [".env", ".env.local", ".env.production", ".env.production.local"])
    assert(!existsSync(join(dir, name)), "PAIR_ENV_FILE_REFUSED");
}
const pin = JSON.parse(readFileSync(join(salonPath, "scripts/integration/pair.json"), "utf8"));
const git = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
const revision = (cwd: string) => ({
  sha: git(cwd, "rev-parse", "HEAD"),
  dirty: Boolean(git(cwd, "status", "--porcelain")),
});
const pair = { salon: revision(salonPath), gateway: revision(gatewayPath) };
assert.equal(pair.gateway.sha, pin.gatewayRevision, "PAIR_GATEWAY_REVISION_MISMATCH");
if (process.env.CI) assert(!pair.salon.dirty && !pair.gateway.dirty, "PAIR_DIRTY_CI_REFUSED");
assert.equal(JSON.parse(readFileSync(join(gatewayPath, "package.json"), "utf8")).name, "booking-lab-gateway");
const { db } = await import("../../src/lib/db");
const { createAgentApiKey, revokeAgentApiKey } = await import("../../src/lib/agent-api/keys");
const { cleanupRun, grant } = await import("../agentprov/fixtures.mjs");
const baseEnv = { NODE_ENV: "production" as const, ...Object.fromEntries(["PATH", "SystemRoot", "SYSTEMROOT", "TEMP", "TMP", "USERPROFILE", "HOME",
  "APPDATA", "LOCALAPPDATA", "PLAYWRIGHT_BROWSERS_PATH"].flatMap(name =>
  process.env[name] === undefined ? [] : [[name, process.env[name]!]])) };
const token = randomBytes(32).toString("hex");
const salonEnv = { ...baseEnv, NEXT_TELEMETRY_DISABLED: "1", DATABASE_URL: process.env.DATABASE_URL!,
  SESSION_SECRET: randomBytes(32).toString("hex") };
const children = new Set<ChildProcess>();
const checks: string[] = [];
const run = `agentprov-${randomUUID()}`;
let step = "START_SERVICES";
let fault: "none" | "drop-booking" | "restart-after-access" | "fail-access" | "fail-operation" = "none";
let savedBooking: string | undefined;
let salon: ChildProcess | undefined;
let salonPort: number;
let gatewayOrigin: string;

function pass(code: string) { checks.push(code); console.log("PASS " + code); }
async function freePort() {
  const server = createServer();
  await new Promise<void>(r => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as { port: number }).port;
  await new Promise<void>(r => server.close(() => r()));
  return port;
}
async function stop(child: ChildProcess | undefined) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  await new Promise<void>(resolve => {
    const timer = setTimeout(() => child.kill("SIGKILL"), 5000);
    child.once("exit", () => { clearTimeout(timer); resolve(); });
    child.kill("SIGTERM");
  });
}
function launch(cwd: string, args: string[], env: NodeJS.ProcessEnv, ready?: string) {
  return new Promise<ChildProcess>((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
    children.add(child);
    const timer = setTimeout(() => reject(new Error("PAIR_PROCESS_TIMEOUT")), ready ? 45000 : 180000);
    child.on("error", () => { clearTimeout(timer); reject(new Error("PAIR_PROCESS_START_FAILED")); });
    let buffer = "";
    child.stdout!.on("data", chunk => {
      buffer += String(chunk);
      for (let end; (end = buffer.indexOf("\n")) >= 0;) {
        const line = buffer.slice(0, end).trim(); buffer = buffer.slice(end + 1);
        if (ready && line.startsWith(ready)) { clearTimeout(timer); resolve(child); }
        if (/^PASS [A-Z_]+$/.test(line)) console.log(line);
      }
      if (buffer.length > 8192) buffer = "";
    });
    // Only static proof-step codes may leave the child, never exception data.
    let errors = "";
    child.stderr!.on("data", chunk => {
      errors += String(chunk);
      for (let end; (end = errors.indexOf("\n")) >= 0;) {
        const line = errors.slice(0, end).trim(); errors = errors.slice(end + 1);
        if (/^FAIL [A-Z_]+$/.test(line)) console.error(line);
      }
      if (errors.length > 8192) errors = "";
    });
    child.on("exit", code => {
      children.delete(child); clearTimeout(timer);
      if (!ready && code === 0) resolve(child);
      else reject(new Error("PAIR_PROCESS_FAILED"));
    });
  });
}
async function startSalon(mode: "split" | "standalone") {
  await stop(salon);
  salon = await launch(salonPath, ["scripts/server.mjs"], {
    ...salonEnv, PORT: String(salonPort),
    BOOKING_PUBLIC_ORIGIN: nativeCodex ? `http://127.0.0.1:${salonPort}` : gatewayOrigin,
    ...(nativeCodex ? { BOOKING_CONSENT_LAB: "1", BOOKING_RUNTIME: "local" } : {}),
    ...(mode === "split" ? { BOOKING_SERVICE_ROLE: "salon", GATEWAY_SERVICE_TOKEN: token } : {}),
  }, "BOOKING_SERVER_READY");
}
// Fault injection is confined to this loopback test proxy, outside both products.
const proxy = createServer(async (req, res) => {
  try {
    const access = req.url === "/api/v1/access";
    if ((fault === "fail-access" && access) || (fault === "fail-operation" && !access)) {
      fault = "none";
      res.writeHead(500, { "content-type": "application/json", "x-internal": "synthetic-internal" });
      res.end(JSON.stringify({ privateDetail: "synthetic-internal" })); return;
    }
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const headers = new Headers();
    for (const name of ["authorization", "x-api-key", "x-booking-gateway-token", "content-type", "idempotency-key"])
      if (typeof req.headers[name] === "string") headers.set(name, req.headers[name]);
    const response = await fetch(`http://127.0.0.1:${salonPort}${req.url}`, {
      method: req.method, headers, redirect: "error", signal: AbortSignal.timeout(20000),
      ...(!["GET", "HEAD"].includes(req.method!) ? { body: Buffer.concat(chunks) } : {}),
    });
    const body = await response.text();
    if (fault === "restart-after-access" && access && response.ok) {
      fault = "none"; await startSalon("standalone");
    }
    if (fault === "drop-booking" && req.url === "/api/v1/bookings" && response.status === 201) {
      fault = "none"; savedBooking = JSON.parse(body).booking.id; res.destroy(); return;
    }
    // fetch decodes compressed responses; do not forward their wire encoding/length.
    const outgoing = new Headers(response.headers);
    for (const name of ["content-encoding", "content-length", "transfer-encoding"]) outgoing.delete(name);
    res.writeHead(response.status, Object.fromEntries(outgoing)); res.end(body);
  } catch {
    res.writeHead(503, { "content-type": "application/json" }); res.end('{"error":{"code":"provider_unavailable"}}');
  }
});

try {
  salonPort = await freePort();
  const gatewayPort = await freePort();
  gatewayOrigin = `http://127.0.0.1:${gatewayPort}`;
  await new Promise<void>(r => proxy.listen(0, "127.0.0.1", r));
  await startSalon("split");
  const gatewayEnv = { ...baseEnv, PORT: String(gatewayPort), GATEWAY_SERVICE_TOKEN: token,
    SALON_ORIGIN: `http://127.0.0.1:${(proxy.address() as { port: number }).port}` };
  assert(!("DATABASE_URL" in gatewayEnv) && !("SESSION_SECRET" in gatewayEnv));
  await launch(gatewayPath, ["src/server.js"], gatewayEnv, "GATEWAY_READY");
  console.log(`PAIR salon=${pair.salon.sha} gateway=${pair.gateway.sha} dirty=${pair.salon.dirty || pair.gateway.dirty}`);
  step = "EXISTING_TWO_CLIENT_PROOF";
  await launch(salonPath, ["--import", "tsx", "scripts/agentprov/run.mts"], {
    ...salonEnv, AGENTPROV_BASE_URL: gatewayOrigin, AGENTPROV_SALON_URL: `http://127.0.0.1:${salonPort}`,
  });
  pass("TWO_CLIENTS_AND_AUTHENTICATED_CALENDAR");
  step = "PROVISION_FAULT_FIXTURES";
  const make = (suffix: string) => createAgentApiKey({ businessId: "demo", agentName: `${run}-${suffix}`,
    ownerName: "Synthetic operator", ownerContact: "operator@example.test", kind: "demo-script" }, db);
  const a = await make("a"), b = await make("b");
  const call = (method: string, path: string, body?: unknown, key?: string, credential = a.key) =>
    fetch(new URL(path, gatewayOrigin), { method, redirect: "error", signal: AbortSignal.timeout(40000),
      headers: { authorization: `Bearer ${credential}`, "content-type": "application/json",
        ...(key ? { "idempotency-key": key } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const services = await (await call("GET", "/api/v1/services?business=demo")).json();
  const service = services.services.find((s: { id: string }) => s.id === "massage");
  assert(service);
  const slots: { start: string; end: string; serviceId: string; durationMinutes: number; staff: { id: string } }[] = [];
  for (let d = 1; d <= 14 && slots.length < 3; d++) {
    const date = DateTime.now().setZone("Europe/Stockholm").plus({ days: d }).toISODate();
    const response = await call("GET", `/api/v1/availability?business=demo&service=massage&date=${date}`);
    assert.equal(response.status, 200);
    for (const slot of (await response.json()).slots) {
      if (slot.staff.id === service.staff[0].id && (!slots.length || slot.start >= slots.at(-1)!.end)) slots.push(slot);
      if (slots.length === 3) break;
    }
  }
  assert.equal(slots.length, 3);
  const payload = async (slot: typeof slots[number], suffix: string) => ({
    business: "demo", serviceId: service.id, serviceVersion: service.version, staffId: slot.staff.id,
    start: slot.start, confirmed: true, customer: { name: "Synthetic transport", email: `${run}-${suffix}@example.test` },
    mandateId: (await grant(a.record.clientId, slot, service.price.amountMinor, run)).id,
  });
  step = "LOST_SUCCESS_RESPONSE";
  const first = await payload(slots[0], "lost"), key = randomUUID();
  fault = "drop-booking";
  assert.equal((await call("POST", "/api/v1/bookings", first, key)).status, 503);
  assert(savedBooking);
  const replay = await call("POST", "/api/v1/bookings", first, key);
  assert.equal(replay.status, 200); assert.equal((await replay.json()).booking.id, savedBooking);
  assert.equal(await db.agentBooking.count({ where: { clientId: a.record.clientId } }), 1);
  pass("LOST_SUCCESS_RETRY_ONE_BOOKING");
  step = "FOREIGN_CLIENT";
  assert.equal((await call("GET", `/api/v1/bookings/${savedBooking}`, undefined, undefined, b.key)).status, 404);
  assert.equal((await call("POST", `/api/v1/bookings/${savedBooking}/cancel`, undefined, undefined, b.key)).status, 404);
  pass("FOREIGN_READ_AND_CANCEL_DENIED");
  step = "RESTART_BETWEEN_CHECK_AND_WRITE";
  const second = await payload(slots[1], "restart"), secondKey = randomUUID();
  fault = "restart-after-access";
  assert.equal((await call("POST", "/api/v1/bookings", second, secondKey)).status, 503);
  assert.equal(await db.agentBooking.count({ where: { clientId: a.record.clientId } }), 1);
  await startSalon("split");
  assert.equal((await call("POST", "/api/v1/bookings", second, secondKey)).status, 201);
  pass("RESTART_RACE_REFUSED_AND_RECOVERED");
  step = "PARALLEL_BOOKINGS";
  const requests = await Promise.all(Array.from({ length: 20 }, (_, i) => payload(slots[2], "race-" + i)));
  const outcomes = await Promise.all(requests.map(body => call("POST", "/api/v1/bookings", body, randomUUID())));
  assert.equal(outcomes.filter(r => r.status === 201).length, 1);
  assert.equal(outcomes.filter(r => r.status === 409).length, 19);
  for (const response of outcomes.filter(r => r.status === 409))
    assert.equal((await response.json()).error.code, "slot_unavailable");
  assert.equal(await db.agentBooking.count({ where: { clientId: a.record.clientId } }), 3);
  const overlaps = await db.$queryRaw<{ count: number }[]>`
    SELECT COUNT(*)::int AS count FROM "Booking" a JOIN "Booking" b
      ON a.id < b.id AND a."businessId" = b."businessId" AND a."staffId" = b."staffId"
      AND tstzrange(a."startsAt", a."endsAt", '[)') && tstzrange(b."startsAt", b."endsAt", '[)')
    WHERE a."businessId" = 'demo' AND a.status = 'confirmed' AND b.status = 'confirmed'`;
  assert.equal(overlaps[0].count, 0);
  pass("TWENTY_REQUESTS_ONE_WINNER");
  step = "SANITISED_ERRORS";
  for (const injected of ["fail-access", "fail-operation"] as const) {
    fault = injected;
    const response = await call("GET", "/api/v1/services?business=demo");
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("x-internal"), null);
    assert(!(await response.text()).includes("synthetic-internal"));
  }
  pass("PROVIDER_ERRORS_REDACTED");
  step = "REVOKED_CLIENT";
  await revokeAgentApiKey(a.record.id, db);
  assert.equal((await call("GET", `/api/v1/bookings/${savedBooking}`)).status, 401);
  pass("REVOKED_CREDENTIAL_DENIED");
  step = "PROVIDER_OUTAGE";
  await stop(salon);
  assert.equal((await call("GET", "/api/v1/services?business=demo", undefined, undefined, b.key)).status, 503);
  await startSalon("split");
  assert.equal((await call("GET", "/api/v1/services?business=demo", undefined, undefined, b.key)).status, 200);
  pass("OUTAGE_AND_RESTART_RECOVERED");
  if (nativeCodex) {
    step = "NATIVE_CODEX_CONSENT_PROOF";
    const { runNativeCodexProof } = await import("../agentprov/native-codex.mjs");
    await runNativeCodexProof(gatewayOrigin, `http://127.0.0.1:${salonPort}`, pair);
    pass("NATIVE_CODEX_CONSENT_TO_CALENDAR");
  }
} catch {
  console.error("FAIL " + step); process.exitCode = 1;
} finally {
  await Promise.all([...children].map(stop));
  proxy.closeAllConnections();
  await new Promise<void>(r => proxy.close(() => r()));
  try { await cleanupRun(run); pass("OWN_FIXTURES_REMOVED"); }
  catch { process.exitCode = 1; console.error("FAIL PAIR_CLEANUP"); }
  await db.$disconnect();
  mkdirSync(join(salonPath, "test-results"), { recursive: true });
  writeFileSync(join(salonPath, "test-results/integration-pair.json"), JSON.stringify({
    time: new Date().toISOString(), node: process.version, pair, checks,
    passed: !process.exitCode, failedStep: process.exitCode ? step : null,
  }, null, 2) + "\n");
}
