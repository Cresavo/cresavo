import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { inspect } from "node:util";
import { closeSync, fstatSync, ftruncateSync, mkdtempSync, openSync, readSync, rmSync, statSync, writeSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pg from "pg";
import { DateTime } from "luxon";
import { db } from "../../src/lib/db";
import { createBooking } from "../../src/lib/domain";
import { authenticateAgent, createAgentApiKey } from "../../src/lib/agent-api/keys";
import { createProposal, customerDecision, getProposal, proposalHash } from "../../src/lib/agent-api/proposals";
import { createAgentBooking } from "../../src/lib/agent-api/bookings";
import { handleMcp } from "../../src/lib/agent-api/mcp";
import { mapAgentError } from "../../src/lib/agent-api/v1";
import { openInboxLink, sealInboxLink, STAGING_CHANNEL, STAGING_CUSTOMER, stagingConsentOrigin, stagingInbox } from "../../src/lib/agent-api/consent-staging";
import * as decisionRoute from "../../src/app/consent/[id]/decision/route";
import { consentOutcome, parseStagingView } from "../../src/app/consent/[id]/staging-copy";
import { POST as restPropose } from "../../src/app/api/v1/proposals/route";
import { GET as restStatus } from "../../src/app/api/v1/proposals/[id]/route";
import { rpcBody } from "../helpers/oauth";

// Fictional split-mode staging configuration. Nothing here is a real address or credential.
const consentOrigin = "https://salon-demo.cresavo.test";
const gatewayOrigin = "https://gateway.cresavo.test";
const serviceToken = randomBytes(32).toString("hex");
const addressSecret = "synthetic-staging-socket-proof";
const customerIp = "198.51.100.7";
const serviceId = `staging-service-${randomUUID()}`, staffId = `staging-staff-${randomUUID()}`;
const clients: string[] = [];
// Booking is open for 60 days ahead. Fixtures start two days out and may use at most 30 weekdays,
// which always ends within 44 days whatever weekday the suite runs on.
const SLOT_BUDGET = 30;
const fixtureStart = () => DateTime.now().setZone("Europe/Stockholm").startOf("day").plus({ days: 2 });
/** Distinct weekdays at 13:00 Stockholm: the cursor moves past the day actually returned. */
function weekdaySlots(from: DateTime) {
  let cursor = from, used = 0;
  return () => {
    if (++used > SLOT_BUDGET) throw new Error("FIXTURE_SLOT_BUDGET_EXCEEDED");
    let day = cursor;
    while (day.weekday > 5) day = day.plus({ days: 1 });
    cursor = day.plus({ days: 1 });
    return day.set({ hour: 13 });
  };
}
const nextSlot = weekdaySlots(fixtureStart());

beforeAll(async () => {
  await db.service.create({ data: { id: serviceId, businessId: "demo", name: "Fictional staging treatment", duration: 45, priceOre: 52000 } });
  const template = await db.staff.findUniqueOrThrow({ where: { id: "staff-erik" } });
  await db.staff.create({ data: { id: staffId, businessId: "demo", name: "Fictional Staging Stylist", serviceIds: [serviceId], weekly: template.weekly!, exceptions: [] } });
});
// `npm run test:integration` loads the operator's .env, which may enable a local lab. One fixture
// sets every setting the staging channel needs and clears every one it refuses to run with.
const STAGING_INCOMPATIBLE = ["BOOKING_CONSENT_LAB", "BOOKING_SMS_OTP_LAB", "BOOKING_CONSENT_INBOX_DIR", "PUBLIC_READONLY", "DEBUG", "BOOKING_CONSENT_TTL_SECONDS"];
function stagingEnv() {
  for (const name of STAGING_INCOMPATIBLE) vi.stubEnv(name, undefined);
  // Ordinary scenarios share one customer address; a PostgreSQL bucket for it would outlive the
  // suite and make a rerun within 15 minutes see 429. The dedicated limiter test opts in itself.
  vi.stubEnv("RATE_LIMIT_STORE", "memory");
  // The inbox key comes from it; a fictional one when the environment has none usable.
  if ((process.env.SESSION_SECRET ?? "").length < 32) vi.stubEnv("SESSION_SECRET", "fictional-integration-session-secret-".padEnd(64, "x"));
  vi.stubEnv("BOOKING_SERVICE_ROLE", "salon"); vi.stubEnv("GATEWAY_SERVICE_TOKEN", serviceToken);
  vi.stubEnv("BOOKING_PUBLIC_ORIGIN", gatewayOrigin); vi.stubEnv("BOOKING_CONSENT_DELIVERY", "staging-inbox");
  vi.stubEnv("BOOKING_CONSENT_ORIGIN", consentOrigin); vi.stubEnv("BOOKING_ADDRESS_SECRET", addressSecret);
}
beforeEach(stagingEnv);

it("runs without Prisma diagnostics, which Prisma fixed when this file was loaded", () => {
  // The integration config refuses DEBUG before any test file loads; Prisma's own cached copy agrees.
  expect(process.env.DEBUG ?? "").toBe("");
  expect((globalThis as { DEBUG?: string }).DEBUG ?? "").toBe("");
});

it("runs with the staging fixture whatever lab settings the operator's environment has", () => {
  vi.stubEnv("BOOKING_CONSENT_LAB", "1"); vi.stubEnv("BOOKING_SMS_OTP_LAB", "1"); vi.stubEnv("BOOKING_CONSENT_INBOX_DIR", "/tmp/fictional-lab-inbox");
  vi.stubEnv("DEBUG", "prisma:client"); vi.stubEnv("RATE_LIMIT_STORE", "postgres");
  expect(() => stagingConsentOrigin()).toThrow();
  stagingEnv();
  expect(stagingConsentOrigin()).toBe(consentOrigin);
  expect(process.env.RATE_LIMIT_STORE).toBe("memory");
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
afterAll(async () => {
  const keys = await db.agentApiKey.findMany({ where: { clientId: { in: clients } } });
  const links = await db.agentBooking.findMany({ where: { clientId: { in: clients } } });
  await db.agentApiEvent.deleteMany({ where: { keyId: { in: keys.map(k => k.id) } } });
  await db.agentBooking.deleteMany({ where: { clientId: { in: clients } } });
  await db.booking.deleteMany({ where: { OR: [{ id: { in: links.map(l => l.bookingId) } }, { staffId }] } });
  await db.agentProposal.deleteMany({ where: { clientId: { in: clients } } });
  await db.agentMandate.deleteMany({ where: { clientId: { in: clients } } });
  await db.agentApiKey.deleteMany({ where: { clientId: { in: clients } } });
  await db.agentClient.deleteMany({ where: { id: { in: clients } } });
  await db.staff.deleteMany({ where: { id: staffId } });
  await db.service.deleteMany({ where: { id: serviceId } });
  await db.$disconnect();
});

async function actor() {
  const { key } = await createAgentApiKey({ businessId: "demo", agentName: "Fictional staging assistant", ownerName: "Fictional Operator", ownerContact: "operator@example.test" }, db);
  const principal = await authenticateAgent(new Headers({ authorization: `Bearer ${key}` }), db, "bookings:write");
  clients.push(principal.clientId);
  return { key, principal };
}
function terms() {
  return { business: "demo", serviceId, serviceVersion: 1, staffId, start: nextSlot().toISO()! };
}
async function inbox(proposalId: string) {
  return db.consentInboxMessage.findUniqueOrThrow({ where: { proposalId } });
}
// The operator's view: the sealed row opened with the salon's session secret.
const linkOf = async (proposalId: string) => openInboxLink((await inbox(proposalId)).sealedLink, proposalId);
const secret = async (proposalId: string) => new URL(await linkOf(proposalId)).hash.slice(1);
// A customer off loopback, verified by the socket server's proof header.
function customer(id: string, body: unknown, origin = consentOrigin, ip = customerIp) {
  const headers = new Headers({ origin, "content-type": "application/json", "x-booking-client-ip": ip,
    "x-booking-client-proof": createHmac("sha256", addressSecret).update(ip).digest("hex") });
  return decisionRoute.POST(new Request(`${consentOrigin}/consent/${id}/decision`, { method: "POST", headers, body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });
}
async function decide(id: string, decision: "yes" | "no") {
  const token = await secret(id);
  const view = await customer(id, { token, decision: "view" });
  expect(view.status).toBe(200);
  const { proposalHash: hash } = await view.json();
  return customer(id, { token, decision, proposalHash: hash });
}
const gatewayHeaders = (key: string) => ({ authorization: `Bearer ${key}`, "x-booking-gateway-token": serviceToken, "content-type": "application/json" });
const bookingBody = (p: ReturnType<typeof terms>, mandateId: string, person: { name: string; email: string } = STAGING_CUSTOMER) =>
  ({ ...p, confirmed: true, mandateId, customer: { name: person.name, email: person.email } });
const counts = async (clientId: string) => ({
  proposals: await db.agentProposal.count({ where: { clientId } }),
  mandates: await db.agentMandate.count({ where: { clientId } }),
  bookings: await db.agentBooking.count({ where: { clientId } }),
});

it("gives every scenario its own weekday slot inside the booking window, on any weekday", () => {
  // Its own generators, so the scenarios' slots are untouched. Every start weekday is checked.
  const today = DateTime.now().setZone("Europe/Stockholm").startOf("day");
  for (let offset = 0; offset < 7; offset++) {
    const next = weekdaySlots(fixtureStart().plus({ days: offset }));
    const starts = Array.from({ length: SLOT_BUDGET }, next);
    expect(new Set(starts.map(s => s.toISO())).size).toBe(SLOT_BUDGET);
    for (const start of starts) expect(start.weekday).toBeLessThan(6);
    // Even shifted by up to a week, the last slot is well inside the 60-day window.
    expect(starts.at(-1)!.diff(today, "days").days).toBeLessThanOrEqual(52);
    expect(() => next()).toThrow("FIXTURE_SLOT_BUDGET_EXCEEDED");
  }
});

it.each(["rest", "mcp"])("%s returns only the proposal id, status and terms; the link stays in the salon inbox", async transport => {
  const { key, principal } = await actor(), args = terms();
  const response = transport === "rest"
    ? await restPropose(new Request(`${gatewayOrigin}/api/v1/proposals`, { method: "POST", headers: gatewayHeaders(key), body: JSON.stringify(args) }))
    : await handleMcp(new Request(`${gatewayOrigin}/api/v1/mcp`, { method: "POST", headers: { ...gatewayHeaders(key), accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "create_proposal", arguments: args } }) }));
  expect(response.status).toBe(transport === "rest" ? 201 : 200);
  const raw = await response.clone().text();
  const body = transport === "rest" ? await response.json() : (await rpcBody(response)).result.structuredContent;
  expect(Object.keys(body).sort()).toEqual(["approvalDelivery", "approvalRequired", "proposal"]);
  expect(body).toMatchObject({ approvalRequired: true, approvalDelivery: "separate-staging-customer", proposal: { status: "pending" } });
  const message = await inbox(body.proposal.id);
  expect(message.recipientId).toBe(STAGING_CUSTOMER.id);
  expect(message.consumedAt).toBeNull();
  // Built from the configured consent origin, with the secret only in the fragment.
  const approvalLink = await linkOf(body.proposal.id), link = new URL(approvalLink);
  // The row itself holds no link-shaped value.
  expect(message.sealedLink).toMatch(/^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]+$/);
  expect(String(message.sealedLink).includes(link.hash.slice(1)), "a secret appears in the checked text").toBe(false);
  expect(link.origin).toBe(consentOrigin);
  expect(link.pathname).toBe(`/consent/${body.proposal.id}`);
  expect(link.search).toBe("");
  expect(link.hash).toMatch(/^#[A-Za-z0-9_-]{43}$/);
  const status = await restStatus(new Request(`${gatewayOrigin}/api/v1/proposals/${body.proposal.id}`, { headers: gatewayHeaders(key) }), { params: Promise.resolve({ id: body.proposal.id }) });
  const statusRaw = await status.text();
  for (const serialized of [raw, statusRaw, JSON.stringify(await getProposal(principal, body.proposal.id))])
    for (const value of [link.hash.slice(1), approvalLink, message.sealedLink, "salon-demo.cresavo.test", "/consent/", "approvalUrl", STAGING_CUSTOMER.email, STAGING_CUSTOMER.id])
      expect(serialized.includes(value), "agent response must not carry customer delivery material").toBe(false);
  expect(await counts(principal.clientId)).toEqual({ proposals: 1, mandates: 0, bookings: 0 });
});

it("the agent cannot choose or read the recipient", async () => {
  const { principal } = await actor(), args = terms();
  for (const patch of [{ customerPhone: "+46700000000" }, { customerSubject: "someone-else" }, { recipient: "other@example.test" },
    { approvalUrl: "https://attacker.example/consent" }, { customer: { name: "Other", email: "other@example.test" } }])
    await expect(createProposal(principal, { ...args, ...patch })).rejects.toBeDefined();
  expect(await db.agentProposal.count({ where: { clientId: principal.clientId } })).toBe(0);
  const created = await createProposal(principal, args);
  expect((await inbox(created.proposal.id)).recipientId).toBe(STAGING_CUSTOMER.id);
  expect((await db.agentProposal.findUniqueOrThrow({ where: { id: created.proposal.id } })).consentDelivery).toBe(STAGING_CHANNEL);
  expect((await decide(created.proposal.id, "yes")).status).toBe(200);
  const { mandateId } = (await getProposal(principal, created.proposal.id)).proposal;
  for (const person of [{ ...STAGING_CUSTOMER, email: "other@example.test" }, { ...STAGING_CUSTOMER, name: "Other Fictional" }])
    await expect(createAgentBooking(principal, randomUUID(), bookingBody(args, mandateId!, person))).rejects.toMatchObject({ code: "mandate_denied" });
  // The database refuses an inbox row for another recipient or another channel.
  await expect(db.$executeRaw`UPDATE "ConsentInboxMessage" SET "recipientId"='other' WHERE "proposalId"=${created.proposal.id}`).rejects.toBeDefined();
  await expect(db.$executeRaw`UPDATE "ConsentInboxMessage" SET "sealedLink"='http://salon-demo.cresavo.test/consent/x#y' WHERE "proposalId"=${created.proposal.id}`).rejects.toBeDefined();
});

it("the delivery profile cannot change once a proposal exists, so a delivered link stays bound", async () => {
  const { principal } = await actor();
  const { proposal } = await createProposal(principal, terms());
  expect((await inbox(proposal.id)).consumedAt).toBeNull();
  // Unbinding (NULL is what the legacy decision path accepts) or moving it to another channel.
  for (const value of [null, "separate-lab-v1"])
    await expect(db.$executeRaw`UPDATE "AgentProposal" SET "consentDelivery"=${value} WHERE "id"=${proposal.id}`).rejects.toThrow(/CONSENT_DELIVERY_IMMUTABLE/);
  expect((await db.agentProposal.findUniqueOrThrow({ where: { id: proposal.id } })).consentDelivery).toBe(STAGING_CHANNEL);
  // Other columns still change, and a no-op write of the same profile is allowed.
  await db.$executeRaw`UPDATE "AgentProposal" SET "consentDelivery"=${STAGING_CHANNEL}, "expiresAt"="expiresAt" WHERE "id"=${proposal.id}`;
  expect((await decide(proposal.id, "no")).status).toBe(200);
  // A proposal without a profile cannot be given one later either, so an inbox row cannot follow.
  const legacy = await db.agentProposal.findFirst({ where: { consentDelivery: null } });
  if (legacy) await expect(db.$executeRaw`UPDATE "AgentProposal" SET "consentDelivery"=${STAGING_CHANNEL} WHERE "id"=${legacy.id}`).rejects.toThrow(/CONSENT_DELIVERY_IMMUTABLE/);
});

/**
 * Only what the server appended since `start`, read from that offset and at most 8 MiB: the rest of
 * a long-lived log is never loaded. Static errors for a rotated (shorter) log or too much output.
 */
function appendedLog(file: string, start: number, limit = 8 * 1024 * 1024) {
  const fd = openSync(file, "r");
  try {
    const size = fstatSync(fd).size;
    if (size < start) throw new Error("STAGING_PG_LOG_ROTATED");
    if (size - start > limit) throw new Error("STAGING_PG_LOG_RANGE_TOO_LARGE");
    const buffer = Buffer.alloc(size - start);
    let read = 0;
    while (read < buffer.length) {
      const n = readSync(fd, buffer, read, buffer.length - read, start + read);
      if (n === 0) break;
      read += n;
    }
    return buffer.subarray(0, read).toString("utf8");
  } finally { closeSync(fd); }
}

it("reads only the appended part of a server log, within a size limit", () => {
  const dir = mkdtempSync(join(tmpdir(), "cresavo-pglog-test-")), file = join(dir, "server.log");
  try {
    // One descriptor for writing, measuring and truncating: nothing is checked by name and then used.
    const fd = openSync(file, "wx+", 0o600);
    try {
      writeSync(fd, "old line\n");
      const start = fstatSync(fd).size;
      writeSync(fd, "new line\n");
      expect(appendedLog(file, start)).toBe("new line\n");
      expect(() => appendedLog(file, start, 4)).toThrow(/^STAGING_PG_LOG_RANGE_TOO_LARGE$/);
      ftruncateSync(fd, 0);
      expect(() => appendedLog(file, start)).toThrow(/^STAGING_PG_LOG_ROTATED$/);
    } finally { closeSync(fd); }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// True when the text carries the secret, also hidden in an encoding (base64url or base64 runs).
function exposes(text: string, secret: string) {
  if (text.includes(secret)) return true;
  for (const run of text.match(/[A-Za-z0-9+/_-]{24,}={0,2}/g) ?? [])
    for (const encoding of ["base64url", "base64"] as const)
      if (Buffer.from(run, encoding).toString("latin1").includes(secret)) return true;
  return false;
}

it("PostgreSQL's own error texts and log carry no usable link when inbox constraints fail", async () => {
  const { principal } = await actor();
  const { proposal } = await createProposal(principal, terms());
  const token = await secret(proposal.id), row = await inbox(proposal.id);
  // Optional: the server log, when the operator can read it (STAGING_PG_LOG=/path/to/postgresql.log).
  const logFile = process.env.STAGING_PG_LOG, logStart = logFile ? statSync(logFile).size : 0;
  const lab = await db.agentProposal.create({ data: { ...(await db.agentProposal.findUniqueOrThrow({ where: { id: proposal.id } })),
    id: randomUUID(), tokenHash: randomBytes(32).toString("hex"), consentDelivery: null, mandateId: null } });
  // Everything PostgreSQL can ever log about these rows is a subset of the values it is sent: the
  // stored row is exactly the insert's bind values. None of them may carry the link, encoded or not.
  for (const value of Object.values(row)) expect(exposes(String(value), token)).toBe(false);
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const texts: string[] = [];
  try {
    // Log as much as any session may: a failing statement's complete bind parameters. (Its row
    // DETAIL is truncated by PostgreSQL to 64 bytes per value; these parameters are not.)
    await client.query("SET log_parameter_max_length_on_error = -1");
    // The failures PostgreSQL logs with their DETAIL (log_min_error_statement = error by default):
    // a CHECK on the row ("Failing row contains ..."), the primary key, and the channel trigger.
    for (const [sql, values] of [
      [`UPDATE "ConsentInboxMessage" SET "recipientId" = 'other' WHERE "proposalId" = $1`, [proposal.id]],
      [`INSERT INTO "ConsentInboxMessage" ("proposalId", "recipientId", "sealedLink") VALUES ($1, $2, $3)`, [proposal.id, STAGING_CUSTOMER.id, row.sealedLink]],
      [`INSERT INTO "ConsentInboxMessage" ("proposalId", "recipientId", "sealedLink") VALUES ($1, $2, $3)`, [lab.id, STAGING_CUSTOMER.id, row.sealedLink]],
      [`UPDATE "ConsentInboxMessage" SET "consumedAt" = now(), "recipientId" = NULL WHERE "proposalId" = $1`, [proposal.id]],
    ] as const) {
      const error = await client.query(sql, [...values]).then(() => null, (e: Error & { detail?: string; where?: string }) => e);
      expect(error === null, "an inbox constraint did not fail").toBe(false);
      texts.push([error!.message, error!.detail, error!.where].join("\n"));
    }
    // Booleans with static messages only: a failure must never print PostgreSQL's texts or log,
    // which can hold other sessions' statements and credentials.
    // The CHECK detail really is row data (so it would be logged): the sealed value, never the link.
    expect(texts.join("\n").includes("Failing row contains"), "PostgreSQL returned a row detail").toBe(true);
    expect(texts.some(text => exposes(text, token)), "a PostgreSQL error text carries the link").toBe(false);
    if (logFile) {
      const appended = appendedLog(logFile, logStart);
      expect(appended.includes("Failing row contains"), "the server log has the row detail").toBe(true);
      // The failing inserts were logged with their parameters, the sealed value in full.
      expect(/parameters: .*\$3 = 'v1\./.test(appended), "the server log has the bind parameters").toBe(true);
      expect(exposes(appended, token), "the server log carries the link").toBe(false);
    }
  } finally {
    await client.end();
    await db.agentProposal.delete({ where: { id: lab.id } });
  }
});

it("a real database failure on the inbox write leaves no trace of the link in errors or output", async () => {
  const { principal } = await actor();
  const { proposal } = await createProposal(principal, terms());
  const lab = await db.agentProposal.create({ data: { ...(await db.agentProposal.findUniqueOrThrow({ where: { id: proposal.id } })),
    id: randomUUID(), tokenHash: randomBytes(32).toString("hex"), consentDelivery: null, mandateId: null } });
  const token = "R".repeat(43);
  const output = [vi.spyOn(console, "error"), vi.spyOn(console, "warn"), vi.spyOn(console, "log"), vi.spyOn(console, "info"),
    vi.spyOn(process.stdout, "write"), vi.spyOn(process.stderr, "write")];
  // A second row for the same proposal (primary key) and a row for a proposal of no staging channel (trigger).
  for (const id of [proposal.id, lab.id]) {
    let thrown: unknown;
    try { await stagingInbox.deliver(db, consentOrigin, id, token); } catch (error) { thrown = error; }
    expect(thrown).toMatchObject({ code: "consent_delivery_unavailable" });
    expect(String(inspect(thrown, { depth: 8, showHidden: true }) + String((thrown as Error).stack)).includes(token), "a secret appears in the checked text").toBe(false);
  }
  for (const spy of output) for (const call of spy.mock.calls) expect(String(JSON.stringify(call)).includes(token), "a secret appears in the checked text").toBe(false);
  expect(await db.consentInboxMessage.count({ where: { sealedLink: { contains: token } } })).toBe(0);
  await db.agentProposal.delete({ where: { id: lab.id } });
});

it("a failed delivery creates no proposal, no mandate and returns no link", async () => {
  const { key, principal } = await actor(), args = terms();
  vi.spyOn(stagingInbox, "deliver").mockRejectedValue(new Error("SYNTHETIC_INBOX_DOWN"));
  await expect(createProposal(principal, args)).rejects.toMatchObject({ code: "consent_delivery_unavailable" });
  const response = await restPropose(new Request(`${gatewayOrigin}/api/v1/proposals`, { method: "POST", headers: gatewayHeaders(key), body: JSON.stringify(args) }));
  expect(response.status).toBe(503);
  const raw = await response.text();
  expect(JSON.parse(raw).error.code).toBe("consent_delivery_unavailable");
  expect(raw).not.toContain("/consent/");
  expect(await counts(principal.clientId)).toEqual({ proposals: 0, mandates: 0, bookings: 0 });
  vi.restoreAllMocks();
  // An unsafe consent origin fails closed before anything is stored.
  vi.stubEnv("BOOKING_CONSENT_ORIGIN", "http://salon-demo.cresavo.test");
  await expect(createProposal(principal, args)).rejects.toMatchObject({ code: "mandate_denied" });
  expect(await counts(principal.clientId)).toEqual({ proposals: 0, mandates: 0, bookings: 0 });
});

it("an approval committed before the response is lost is reported as unconfirmed, never as refused", async () => {
  const { principal } = await actor();
  const { proposal } = await createProposal(principal, terms());
  const token = await secret(proposal.id);
  const { proposalHash: hash } = await (await customer(proposal.id, { token, decision: "view" })).json();
  // The commit succeeds, then the acknowledgement is lost (connection reset).
  const commit = db.$transaction.bind(db) as (...args: unknown[]) => Promise<unknown>;
  vi.spyOn(db, "$transaction").mockImplementationOnce((async (...args: unknown[]) => {
    await commit(...args); throw new Error("SYNTHETIC_CONNECTION_RESET");
  }) as unknown as typeof db.$transaction);
  const response = await customer(proposal.id, { token, decision: "yes", proposalHash: hash });
  expect(response.status).toBe(500);
  const raw = await response.text();
  expect(String(raw).includes(token), "a secret appears in the checked text").toBe(false);
  expect(consentOutcome("yes", { status: response.status, body: JSON.parse(raw) })).toBe("unconfirmed");
  expect((await getProposal(principal, proposal.id)).proposal.status).toBe("approved");
  expect(await counts(principal.clientId)).toMatchObject({ mandates: 1 });
});

it("limits decisions per existing proposal and allocates nothing for made-up proposal IDs", async () => {
  // The PostgreSQL store, shared with login and booking limits: count its rows.
  vi.stubEnv("RATE_LIMIT_STORE", "postgres");
  const { rateLimitDatabase } = await import("../../src/lib/postgres-rate-limit");
  // Per-run addresses and this test's own bucket keys, so reruns and other rows do not matter.
  const run = () => `10.${randomBytes(3).join(".")}`;
  const key = (route: string, identity: string) => createHmac("sha256", process.env.SESSION_SECRET!).update(`rate-limit:v1:${route}:${identity}`).digest("hex");
  const keys: string[] = [];
  const buckets = async (list: string[]) => rateLimitDatabase.rateLimitBucket.findMany({ where: { key: { in: list } } });
  try {
    const { principal } = await actor();
    const { proposal } = await createProposal(principal, terms());
    const probe = run(), madeUp = Array.from({ length: 10 }, () => randomUUID());
    keys.push(key("consent-ip", probe), ...madeUp.map(id => key("consent-proposal", id)));
    for (const id of madeUp) expect((await customer(id, { token: "T".repeat(43), decision: "view" }, consentOrigin, probe)).status).toBe(403);
    // Ten made-up IDs from one address: that address's bucket, no proposal buckets.
    expect((await buckets(keys)).map(b => [b.key, b.count])).toEqual([[key("consent-ip", probe), 10]]);
    const token = await secret(proposal.id);
    const addresses = Array.from({ length: 10 }, run);
    keys.push(key("consent-proposal", proposal.id), ...addresses.map(a => key("consent-ip", a)));
    for (let i = 0; i < 20; i++) expect((await customer(proposal.id, { token, decision: "view" }, consentOrigin, addresses[i % 10])).status).toBe(200);
    const last = run(); keys.push(key("consent-ip", last));
    const limited = await customer(proposal.id, { token, decision: "view" }, consentOrigin, last);
    expect(limited.status).toBe(429);
    expect(await limited.json()).toEqual({ error: "consent_rate_limited" });
    expect((await buckets([key("consent-proposal", proposal.id)]))[0].count).toBe(20);
    expect((await getProposal(principal, proposal.id)).proposal.status).toBe("pending");
  } finally {
    await rateLimitDatabase.rateLimitBucket.deleteMany({ where: { key: { in: keys } } });
  }
});

it("callers without the link cannot use up the customer's decision budget", async () => {
  vi.stubEnv("RATE_LIMIT_STORE", "postgres");
  const { rateLimitDatabase } = await import("../../src/lib/postgres-rate-limit");
  const key = (route: string, identity: string) => createHmac("sha256", process.env.SESSION_SECRET!).update(`rate-limit:v1:${route}:${identity}`).digest("hex");
  const address = () => `10.${randomBytes(3).join(".")}`;
  const { principal } = await actor();
  const { proposal } = await createProposal(principal, terms());
  const keys = [key("consent-proposal", proposal.id)], addresses = Array.from({ length: 25 }, address);
  keys.push(...addresses.map(a => key("consent-ip", a)));
  try {
    // The agent knows the proposal ID; without the secret every request is refused...
    for (const [i, ip] of addresses.entries()) {
      const response = await customer(proposal.id, { token: `W${String(i).padStart(42, "0")}`, decision: "view" }, consentOrigin, ip);
      expect(response.status).toBe(403);
    }
    // ...and charges nothing to the proposal's own budget.
    expect(await rateLimitDatabase.rateLimitBucket.count({ where: { key: key("consent-proposal", proposal.id) } })).toBe(0);
    const last = address(); keys.push(key("consent-ip", last));
    const view = await customer(proposal.id, { token: await secret(proposal.id), decision: "view" }, consentOrigin, last);
    expect(view.status).toBe(200);
    expect((await rateLimitDatabase.rateLimitBucket.findUniqueOrThrow({ where: { key: key("consent-proposal", proposal.id) } })).count).toBe(1);
  } finally {
    await rateLimitDatabase.rateLimitBucket.deleteMany({ where: { key: { in: keys } } });
  }
});

it("opening the link approves nothing; there is no GET decision handler", async () => {
  const { principal } = await actor();
  const { proposal } = await createProposal(principal, terms());
  expect("GET" in decisionRoute).toBe(false);
  const view = await customer(proposal.id, { token: await secret(proposal.id), decision: "view" });
  expect(view.status).toBe(200);
  const shown = await view.json();
  expect(shown.terms).toEqual({ salonName: "Salong Eko (synthetic demo)", locationId: "demo-location", locationName: "Fictional demo studio, Stockholm", timeZone: "Europe/Stockholm", currency: "SEK" });
  expect(shown.proposal).toMatchObject({ serviceName: "Fictional staging treatment", staff: { name: "Fictional Staging Stylist" }, durationMinutes: 45, price: { amountMinor: 52000, currency: "SEK" } });
  expect(shown.customer).toBe(`${STAGING_CUSTOMER.name} · ${STAGING_CUSTOMER.email}`);
  // One salon name for the agent and the customer.
  expect(shown.proposal.salon).toBe(shown.terms.salonName);
  expect((await getProposal(principal, proposal.id)).proposal.salon).toBe(shown.terms.salonName);
  // The page's own validator accepts what the salon actually sends.
  expect(parseStagingView(shown)).not.toBeNull();
  expect((await getProposal(principal, proposal.id)).proposal.status).toBe("pending");
  expect((await inbox(proposal.id)).consumedAt).toBeNull();
  expect(await counts(principal.clientId)).toMatchObject({ mandates: 0 });
});

it("explicit approval binds the mandate to exactly the displayed terms and consumes the link", async () => {
  const { principal } = await actor(), args = terms();
  const { proposal } = await createProposal(principal, args);
  const token = await secret(proposal.id);
  const seen = await (await customer(proposal.id, { token, decision: "view" })).json();
  // Wrong origin, agent credentials or a different hash grant nothing.
  expect((await customer(proposal.id, { token, decision: "yes", proposalHash: seen.proposalHash }, "http://127.0.0.1:3217")).status).toBe(403);
  expect((await customer(proposal.id, { token, decision: "yes", proposalHash: "0".repeat(64) })).status).toBe(403);
  expect(await counts(principal.clientId)).toMatchObject({ mandates: 0 });
  const approved = await customer(proposal.id, { token, decision: "yes", proposalHash: seen.proposalHash });
  expect(await approved.json()).toEqual({ status: "approved" });
  const row = await db.agentProposal.findUniqueOrThrow({ where: { id: proposal.id } });
  const mandate = await db.agentMandate.findUniqueOrThrow({ where: { id: row.mandateId! } });
  expect(mandate).toMatchObject({ origin: "customer-consent", verifiedVia: STAGING_CHANNEL, proposalHash: proposalHash(row), serviceId, staffId,
    maxPriceOre: 52000, currency: "SEK", locationId: row.locationId, scheduleId: row.scheduleId, originReference: proposal.id });
  expect(seen.proposalHash).toBe(proposalHash(row));
  expect(+mandate.validFrom).toBe(+new Date(args.start));
  expect(+mandate.validUntil).toBe(+new Date(args.start) + 45 * 60000);
  expect((await inbox(proposal.id)).consumedAt).not.toBeNull();
});

it("decline leaves no mandate and the link shows a used state", async () => {
  const { principal } = await actor();
  const { proposal } = await createProposal(principal, terms());
  expect(await (await decide(proposal.id, "no")).json()).toEqual({ status: "declined" });
  const read = (await getProposal(principal, proposal.id)).proposal;
  expect(read.status).toBe("declined");
  expect("mandateId" in read).toBe(false);
  const again = await customer(proposal.id, { token: await secret(proposal.id), decision: "view" });
  expect(again.status).toBe(409);
  // The link holder learns the recorded decision, and nothing else.
  expect(await again.json()).toEqual({ error: "consent_denied", state: "used", decision: "declined" });
  expect(await counts(principal.clientId)).toMatchObject({ mandates: 0 });
});

it("an expired link shows an expired state and creates no mandate", async () => {
  const { principal } = await actor();
  const { proposal } = await createProposal(principal, terms());
  const token = await secret(proposal.id);
  const seen = await (await customer(proposal.id, { token, decision: "view" })).json();
  await db.agentProposal.update({ where: { id: proposal.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
  for (const body of [{ token, decision: "view" }, { token, decision: "yes", proposalHash: seen.proposalHash }]) {
    const response = await customer(proposal.id, body);
    expect(response.status).toBe(410);
    expect(await response.json()).toEqual({ error: "consent_denied", state: "expired" });
  }
  expect((await getProposal(principal, proposal.id)).proposal.status).toBe("expired");
  expect(await counts(principal.clientId)).toMatchObject({ mandates: 0 });
});

it("a reused link grants nothing more", async () => {
  const { principal } = await actor();
  const { proposal } = await createProposal(principal, terms());
  const token = await secret(proposal.id);
  const seen = await (await customer(proposal.id, { token, decision: "view" })).json();
  expect((await customer(proposal.id, { token, decision: "yes", proposalHash: seen.proposalHash })).status).toBe(200);
  for (const decision of ["yes", "no", "view"]) {
    const response = await customer(proposal.id, { token, decision, proposalHash: seen.proposalHash });
    expect(response.status).toBe(409);
    // The recorded decision only: no terms, no mandate ID, no authority.
    expect(await response.json()).toEqual({ error: "consent_denied", state: "used", decision: "approved" });
  }
  // Still the recorded approval once the proposal's approval window has passed, not "expired".
  await db.agentProposal.update({ where: { id: proposal.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
  expect(await (await customer(proposal.id, { token, decision: "view" })).json()).toEqual({ error: "consent_denied", state: "used", decision: "approved" });
  // A wrong secret learns nothing about the decision.
  const stranger = await customer(proposal.id, { token: "W".repeat(43), decision: "view" });
  expect(stranger.status).toBe(403);
  expect(await stranger.json()).toEqual({ error: "consent_denied" });
  // Concurrent replays of the same link still produce exactly one mandate.
  const fresh = await createProposal(principal, terms()), freshToken = await secret(fresh.proposal.id);
  const freshSeen = await customerDecision(fresh.proposal.id, { token: freshToken, decision: "view" });
  const outcomes = await Promise.allSettled(Array.from({ length: 10 }, () =>
    customerDecision(fresh.proposal.id, { token: freshToken, decision: "yes", proposalHash: freshSeen.proposalHash })));
  expect(outcomes.filter(o => o.status === "fulfilled")).toHaveLength(1);
  expect(await counts(principal.clientId)).toMatchObject({ mandates: 2 });
});

it("booking keeps the salon checks: changed price, slot taken, idempotent replay", async () => {
  const { principal } = await actor();
  async function approvedMandate(args: ReturnType<typeof terms>) {
    const { proposal } = await createProposal(principal, args);
    expect((await decide(proposal.id, "yes")).status).toBe(200);
    return (await getProposal(principal, proposal.id)).proposal.mandateId!;
  }
  const priced = terms(), pricedMandate = await approvedMandate(priced);
  await db.service.update({ where: { id: serviceId }, data: { priceOre: 51000 } });
  try {
    await expect(createAgentBooking(principal, randomUUID(), bookingBody(priced, pricedMandate))).rejects.toMatchObject({ code: "mandate_denied" });
  } finally { await db.service.update({ where: { id: serviceId }, data: { priceOre: 52000 } }); }
  const taken = terms(), takenMandate = await approvedMandate(taken);
  await createBooking({ serviceId, staffId, start: taken.start, customerName: "Fictional Visitor", customerEmail: "visitor@example.test" });
  const conflict = await createAgentBooking(principal, randomUUID(), bookingBody(taken, takenMandate)).catch(error => error);
  expect(mapAgentError(conflict).code).toBe("slot_unavailable");
  const happy = terms(), happyMandate = await approvedMandate(happy), key = randomUUID();
  const first = await createAgentBooking(principal, key, bookingBody(happy, happyMandate));
  const replay = await createAgentBooking(principal, key, bookingBody(happy, happyMandate));
  const firstId = ("body" in first ? first.body : first) as { booking: { id: string } };
  expect(replay).toMatchObject({ replayed: true, booking: { id: firstId.booking.id } });
  expect(await db.agentBooking.count({ where: { mandateId: happyMandate } })).toBe(1);
});

it("channels never cross: lab links are refused in staging and staging links outside it", async () => {
  const { principal } = await actor();
  const { proposal } = await createProposal(principal, terms());
  const token = await secret(proposal.id);
  // Switch the salon back to the local lab: the staging proposal is not decidable there.
  for (const name of ["BOOKING_CONSENT_DELIVERY", "BOOKING_CONSENT_ORIGIN", "BOOKING_SERVICE_ROLE", "GATEWAY_SERVICE_TOKEN"]) vi.stubEnv(name, undefined);
  vi.stubEnv("BOOKING_CONSENT_LAB", "1"); vi.stubEnv("BOOKING_RUNTIME", "local"); vi.stubEnv("BOOKING_PUBLIC_ORIGIN", "http://127.0.0.1:3229");
  await expect(customerDecision(proposal.id, { token, decision: "view" })).rejects.toMatchObject({ code: "mandate_denied" });
  const lab = await createProposal(principal, terms()), labToken = new URL(lab.approvalUrl!).hash.slice(1);
  // Back to staging through the same fixture, which also clears the lab switch set above.
  vi.unstubAllEnvs();
  stagingEnv();
  await expect(customerDecision(lab.proposal.id, { token: labToken, decision: "view" })).rejects.toMatchObject({ code: "mandate_denied" });
  expect(await db.consentInboxMessage.count({ where: { proposalId: lab.proposal.id } })).toBe(0);
  await expect(db.consentInboxMessage.create({ data: { proposalId: lab.proposal.id, recipientId: STAGING_CUSTOMER.id,
    sealedLink: sealInboxLink(`${consentOrigin}/consent/${lab.proposal.id}#${"a".repeat(43)}`, lab.proposal.id) } })).rejects.toBeDefined();
  expect(await counts(principal.clientId)).toMatchObject({ mandates: 0 });
});
