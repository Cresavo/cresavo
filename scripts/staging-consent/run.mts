// Staging run of the split-mode customer consent channel over HTTPS, isolated on this
// machine: a new PostgreSQL _test database, the split salon, the real gateway from a
// separate checkout, and per-run TLS in front of both. See docs/CUSTOMER_CONSENT_CHANNEL.md.
// No .env loading. Prints sanitized results only. Never commit its output unreviewed.
import assert from "node:assert/strict";
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { isIP } from "node:net";
import { join, resolve, sep } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { DateTime } from "luxon";
import { assertTestDatabase } from "../test-db-guard.mjs";
import { createDatabaseClient } from "../database.mjs";
import { containsSecret, registerSecret, say } from "./sanitize.mjs";
import { captured, freePort, runStep, startServer, stopAll } from "./processes.mjs";
import { issueCertificates, operatorFetch, tlsProxy } from "./tls.mjs";
import { close, decide, expectedText, launchBrowser, openConsent, ownerOpensBooking } from "./browsers.mjs";

const repo = realpathSync(fileURLToPath(new URL("../..", import.meta.url)));
const pin = JSON.parse(readFileSync(join(repo, "scripts/staging-consent/gateway.json"), "utf8"));
const results: string[] = [];
let failures = 0;
let step = "PREFLIGHT";
const pass = (code: string, detail = "") => { results.push(code); say(`PASS ${code}${detail ? " - " + detail : ""}`); };
const sayRevision = (label: string, sha: string, dirty: boolean) => {
  assert.match(sha, /^[a-f0-9]{40}$/);
  console.log(`REVISION ${label} ${sha}${dirty ? " (working tree has uncommitted changes)" : ""}`);
};
async function scenario(code: string, run: () => Promise<void>) {
  step = code;
  try { await run(); pass(code); }
  catch (error) {
    failures++;
    // A static code and, only on request, a sanitized message. Never raw responses or URLs.
    say(`FAIL ${code}${process.env.STAGING_DEBUG === "1" ? " - " + String((error as Error)?.message) : ""}`);
  }
}

// ---- Preflight: configuration comes only from this process environment ----
const checkoutValue = process.env.GATEWAY_CHECKOUT;
assert(checkoutValue, "Set GATEWAY_CHECKOUT to a separate gateway checkout outside this repository");
const checkout = realpathSync(resolve(checkoutValue));
assert(!(checkout + sep).startsWith(repo + sep) && !(repo + sep).startsWith(checkout + sep), "STAGING_GATEWAY_CHECKOUT_INSIDE_REPOSITORY");
for (const dir of [repo, checkout])
  for (const name of [".env", ".env.local", ".env.production", ".env.production.local"])
    assert(!existsSync(join(dir, name)), "STAGING_ENV_FILE_REFUSED");
assert(!process.env.VERCEL && !process.env.VERCEL_ENV, "STAGING_CLOUD_REFUSED");
const hostPattern = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{0,61}[a-z0-9]$/;
const gatewayHost = (process.env.STAGING_GATEWAY_HOST ?? "gateway.cresavo.test").toLowerCase();
const salonHost = (process.env.STAGING_SALON_HOST ?? "salon-demo.cresavo.test").toLowerCase();
for (const host of [gatewayHost, salonHost]) assert(hostPattern.test(host) && !isIP(host), "STAGING_HOST_INVALID");
assert.notEqual(gatewayHost, salonHost, "STAGING_HOSTS_MUST_DIFFER");
const adminUrl = new URL(process.env.STAGING_PG_ADMIN_URL ?? "postgresql://booking:booking@127.0.0.1:5432/postgres");
assert(["127.0.0.1", "localhost", "[::1]"].includes(adminUrl.hostname), "STAGING_DATABASE_MUST_BE_LOOPBACK");
const git = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
const gatewayRevision = process.env.STAGING_GATEWAY_REVISION ?? pin.gatewayRevision;
assert.match(gatewayRevision, /^[a-f0-9]{40}$/);
assert.equal(git(checkout, "rev-parse", `${gatewayRevision}^{commit}`), gatewayRevision, "STAGING_GATEWAY_REVISION_MISSING");
const salonRevision = { sha: git(repo, "rev-parse", "HEAD"), dirty: git(repo, "status", "--porcelain") !== "" };
if (process.env.CI) assert(!salonRevision.dirty, "STAGING_DIRTY_CI_REFUSED");
sayRevision("cresavo", salonRevision.sha, salonRevision.dirty);
sayRevision("gateway", gatewayRevision, false);
say(`HOSTS gateway=${gatewayHost} salon=${salonHost} (loopback only, ephemeral CA)`);

// ---- Private run directory: keys, gateway copy and nothing else ----
const temp = mkdtempSync(join(realpathSync(tmpdir()), "cresavo-staging-"));
chmodSync(temp, 0o700);
const dbName = `staging_consent_${randomBytes(6).toString("hex")}_test`;
const databaseUrl = new URL(adminUrl); databaseUrl.pathname = `/${dbName}`;
assertTestDatabase(databaseUrl.href);
registerSecret(databaseUrl.href); registerSecret(adminUrl.href); registerSecret(decodeURIComponent(adminUrl.password));
const serviceToken = randomBytes(32).toString("hex"), sessionSecret = randomBytes(32).toString("hex");
registerSecret(serviceToken); registerSecret(sessionSecret);
const baseEnv = { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? temp, TMPDIR: temp, LANG: "en_US.UTF-8", NEXT_TELEMETRY_DISABLED: "1", CHECKPOINT_DISABLE: "1" };
const dnsHook = join(repo, "scripts/staging-consent/loopback-dns.mjs");
// Outbound settings for the two install/build steps only (registry, fonts). Never given to a server.
const networkEnv = Object.fromEntries(["HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy", "NO_PROXY", "no_proxy",
  "npm_config_https_proxy", "npm_config_noproxy", "npm_config_registry", "NPM_CONFIG_USERCONFIG", "NODE_EXTRA_CA_CERTS", "SSL_CERT_FILE"]
  .flatMap(name => process.env[name] === undefined ? [] : [[name, process.env[name]!]]));
let createdDb = false;
const browsers: { close(): Promise<void> }[] = [];
const servers: { close(): void }[] = [];
let agentProcess: ChildProcess | undefined;
let db: typeof import("../../src/lib/db").db | undefined;

// Only CREATE/DROP of this run's own generated name, outside a transaction.
async function adminQuery(sql: string) {
  const client = createDatabaseClient(adminUrl.href, 1);
  try { await client.$executeRawUnsafe(sql); } finally { await client.$disconnect(); }
}

async function cleanup() {
  agentProcess?.kill("SIGKILL");
  for (const browser of browsers) await browser.close().catch(() => {});
  for (const server of servers) server.close();
  await stopAll();
  await db?.$disconnect().catch(() => {});
  if (createdDb) {
    try { await adminQuery(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`); say("PASS DATABASE_DROPPED"); }
    catch { failures++; say("FAIL DATABASE_DROP"); }
  }
  rmSync(temp, { recursive: true, force: true });
  say(existsSync(temp) ? "FAIL TEMP_DIRECTORY_REMOVED" : "PASS TEMP_DIRECTORY_REMOVED");
}
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => { void cleanup().finally(() => process.exit(130)); });

type AgentReply = { isError?: boolean; body?: Record<string, any>; text?: string; tools?: string[]; failure?: string }; // eslint-disable-line @typescript-eslint/no-explicit-any
const agentTranscript: string[] = [];
function agentClient(env: Record<string, string>) {
  const child = spawn(process.execPath, ["--import", "tsx", "--import", dnsHook, join(repo, "scripts/staging-consent/agent.mts")],
    { cwd: repo, env: env as NodeJS.ProcessEnv, stdio: ["pipe", "pipe", "pipe"] });
  child.stderr.on("data", chunk => { captured.agent = ((captured.agent ?? "") + String(chunk)).slice(-50_000); });
  const pending = new Map<number, (r: AgentReply) => void>();
  let sequence = 0;
  createInterface({ input: child.stdout }).on("line", line => {
    agentTranscript.push(line);
    const reply = JSON.parse(line);
    pending.get(reply.id)?.(reply); pending.delete(reply.id);
  });
  const send = (message: object) => new Promise<AgentReply>((resolveReply, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => reject(new Error("AGENT_TIMEOUT")), 40_000);
    pending.set(id, r => { clearTimeout(timer); if (r.failure) reject(new Error(r.failure)); else resolveReply(r); });
    child.stdin.write(JSON.stringify({ id, ...message }) + "\n");
  });
  return { child, call: (name: string, args: Record<string, unknown>) => send({ name, args }), list: () => send({ list: true }) };
}

try {
  // ---- Database ----
  step = "DATABASE";
  await adminQuery(`CREATE DATABASE "${dbName}"`);
  createdDb = true;
  const dbEnv = { ...baseEnv, DATABASE_URL: databaseUrl.href, SESSION_SECRET: sessionSecret };
  await runStep("MIGRATE", process.execPath, [join(repo, "node_modules/prisma/build/index.js"), "migrate", "deploy"], repo, dbEnv);
  await runStep("SEED", process.execPath, ["--import", "tsx", "prisma/seed.ts"], repo, dbEnv);
  pass("ISOLATED_TEST_DATABASE", "new uniquely named _test database, migrated and seeded");
  if (!process.argv.includes("--skip-build")) {
    step = "BUILD";
    await runStep("BUILD", process.execPath, [join(repo, "node_modules/next/dist/bin/next"), "build"], repo, { ...dbEnv, ...networkEnv, NODE_ENV: "production" }, 900_000);
  }

  // ---- The gateway: the pinned revision exported from the separate checkout into the private run directory ----
  step = "GATEWAY_INSTALL";
  const gatewayDir = join(temp, "gateway");
  mkdirSync(gatewayDir, { mode: 0o700 });
  execFileSync("sh", ["-c", `git -C "$1" archive "$2" | tar -x -C "$3"`, "sh", checkout, gatewayRevision, gatewayDir], { stdio: "ignore" });
  assert.equal(JSON.parse(readFileSync(join(gatewayDir, "package.json"), "utf8")).name, "cresavo-gateway", "STAGING_NOT_A_GATEWAY_CHECKOUT");
  await runStep("GATEWAY_INSTALL", "npm", ["ci", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"], gatewayDir,
    { ...baseEnv, ...networkEnv, npm_config_cache: join(temp, "npm-cache") });

  // ---- TLS and processes ----
  step = "START_SERVICES";
  const tls = issueCertificates(temp, [gatewayHost, salonHost]);
  const [salonPort, gatewayPort] = [await freePort(), await freePort()];
  const salonTls = await tlsProxy(tls.leaves[salonHost], salonPort, "x-real-ip");
  const gatewayTls = await tlsProxy(tls.leaves[gatewayHost], gatewayPort, "x-forwarded-for");
  servers.push(salonTls.server, gatewayTls.server);
  const salonOrigin = `https://${salonHost}:${salonTls.port}`, gatewayOrigin = `https://${gatewayHost}:${gatewayTls.port}`;
  await startServer("salon", process.execPath, ["scripts/server.mjs"], repo, {
    ...dbEnv, NODE_ENV: "production", PORT: String(salonPort), BOOKING_RUNTIME: "local",
    BOOKING_SERVICE_ROLE: "salon", GATEWAY_SERVICE_TOKEN: serviceToken, BOOKING_PUBLIC_ORIGIN: gatewayOrigin,
    BOOKING_CONSENT_DELIVERY: "staging-inbox", BOOKING_CONSENT_ORIGIN: salonOrigin, BOOKING_CONSENT_TTL_SECONDS: "900",
    TRUST_PROXY_IP: "1", TRUSTED_PROXY_IPS: "127.0.0.1", RATE_LIMIT_STORE: "postgres",
  }, "BOOKING_SERVER_READY");
  // The gateway gets no database URL, session secret or inbox: only its port, origins and service token.
  await startServer("gateway", process.execPath, ["--import", dnsHook, "src/server.js"], gatewayDir, {
    PATH: baseEnv.PATH, PORT: String(gatewayPort), SALON_ORIGIN: salonOrigin, GATEWAY_SERVICE_TOKEN: serviceToken,
    GATEWAY_ALLOW_REMOTE: "1", GATEWAY_PUBLIC_ORIGIN: gatewayOrigin, GATEWAY_TRUST_PROXY_HOPS: "1", GATEWAY_LISTEN_HOST: "127.0.0.1",
    NODE_EXTRA_CA_CERTS: tls.caPath, STAGING_LOOPBACK_HOSTS: salonHost,
  }, "GATEWAY_READY");
  pass("HTTPS_SPLIT_STARTED", "salon and gateway each behind TLS with a per-run CA");

  // ---- Operator capabilities: the database. Imported only after the guard. ----
  process.env.DATABASE_URL = databaseUrl.href;
  process.env.SESSION_SECRET = sessionSecret;
  db = (await import("../../src/lib/db")).db;
  const { createAgentApiKey } = await import("../../src/lib/agent-api/keys");
  const { createAdminUser } = await import("../../src/lib/admin-accounts");
  const { createBooking } = await import("../../src/lib/domain");
  const { businessDisplay } = await import("../../src/lib/agent-api/v1");
  const { STAGING_CUSTOMER } = await import("../../src/lib/agent-api/consent-staging");
  const operator = db;
  const agentKey = await createAgentApiKey({ businessId: "demo", agentName: "Fictional staging assistant",
    ownerName: "Fictional operator", ownerContact: "operator@example.test", kind: "demo-script" }, operator);
  registerSecret(agentKey.key);
  const clientId = agentKey.record.clientId;
  const agent = agentClient({ PATH: baseEnv.PATH, HOME: baseEnv.HOME, NODE_EXTRA_CA_CERTS: tls.caPath, STAGING_LOOPBACK_HOSTS: gatewayHost,
    STAGING_AGENT_GATEWAY: gatewayOrigin, STAGING_AGENT_KEY: agentKey.key });
  agentProcess = agent.child;
  const customerBrowser = await launchBrowser(salonHost, tls.leaves[salonHost].spki);
  const ownerBrowser = await launchBrowser(salonHost, tls.leaves[salonHost].spki);
  browsers.push(customerBrowser, ownerBrowser);
  const links: string[] = [];
  async function inboxLink(proposalId: string) {
    const message = await operator.consentInboxMessage.findUniqueOrThrow({ where: { proposalId } });
    assert.equal(message.recipientId, STAGING_CUSTOMER.id);
    const url = new URL(message.approvalLink);
    assert.equal(url.origin, salonOrigin);
    assert.equal(url.pathname, `/consent/${proposalId}`);
    assert.match(url.hash, /^#[A-Za-z0-9_-]{43}$/);
    registerSecret(message.approvalLink); registerSecret(url.hash.slice(1));
    links.push(message.approvalLink);
    return message.approvalLink;
  }
  const state = async (proposalId: string) => ({
    proposal: await operator.agentProposal.findUniqueOrThrow({ where: { id: proposalId } }),
    mandates: await operator.agentMandate.count({ where: { clientId, originReference: proposalId } }),
    bookings: await operator.agentBooking.count({ where: { clientId } }),
    inbox: await operator.consentInboxMessage.findUniqueOrThrow({ where: { proposalId } }),
  });

  // ---- Agent discovery through the gateway ----
  step = "AGENT_CATALOG";
  const tools = (await agent.list()).tools!;
  assert(tools.includes("create_proposal") && tools.includes("get_proposal") && tools.includes("create_booking"));
  assert(!tools.some(name => /inbox|consent|approve|customer/i.test(name)), "no tool reads the inbox or approves");
  const catalog = (await agent.call("list_services", { business: "demo" })).body!;
  const service = catalog.services.find((s: { id: string }) => s.id === "massage") ?? catalog.services[0];
  const slots: { start: string; staff: { id: string; name: string } }[] = [];
  let timeZone = "";
  for (let d = 2; d <= 14 && slots.length < 3; d++) {
    const date = DateTime.now().setZone("Europe/Stockholm").plus({ days: d }).toISODate()!;
    const availability = (await agent.call("get_availability", { business: "demo", service: service.id, date, staff: service.staff[0].id })).body!;
    timeZone = availability.range.timeZone;
    // Starts at least two hours apart: no overlap whatever the duration and buffer.
    for (const slot of availability.slots)
      if (slots.length < 3 && slots.every(s => Math.abs(+new Date(s.start) - +new Date(slot.start)) >= 7_200_000)) slots.push(slot);
  }
  assert.equal(slots.length, 3, "STAGING_NEEDS_THREE_SLOTS");
  pass("AGENT_MCP_OVER_HTTPS_GATEWAY", `${tools.length} tools, catalog and availability via the gateway`);
  const salon = businessDisplay("demo");
  const customerLabel = `${STAGING_CUSTOMER.name} · ${STAGING_CUSTOMER.email}`;

  async function propose(slot: (typeof slots)[number]) {
    const reply = await agent.call("create_proposal", { business: "demo", serviceId: service.id, serviceVersion: service.version, staffId: slot.staff.id, start: slot.start });
    assert.equal(reply.isError, false);
    assert.deepEqual(Object.keys(reply.body!).sort(), ["approvalDelivery", "approvalRequired", "proposal"]);
    assert.equal(reply.body!.approvalDelivery, "separate-staging-customer");
    assert.equal(reply.body!.proposal.status, "pending");
    assert(!("mandateId" in reply.body!.proposal));
    return reply.body!.proposal as { id: string; expiresAt: string; start: string };
  }
  const book = (slot: (typeof slots)[number], mandateId: string | undefined, idempotencyKey = randomUUID()) => agent.call("create_booking", {
    idempotencyKey, business: "demo", serviceId: service.id, serviceVersion: service.version, staffId: slot.staff.id, start: slot.start,
    customer: { name: STAGING_CUSTOMER.name, email: STAGING_CUSTOMER.email }, confirmed: true, ...(mandateId ? { mandateId } : {}) });
  const status = async (proposalId: string) => (await agent.call("get_proposal", { proposalId })).body!.proposal;
  async function approveInBrowser(proposalId: string) {
    const view = await openConsent(customerBrowser, await inboxLink(proposalId));
    try { assert.equal(view.state, "ready"); await decide(view, "approve"); } finally { await close(view); }
    const read = await status(proposalId);
    assert.equal(read.status, "approved");
    return read.mandateId as string;
  }

  let bookingId = "";
  const happy = slots[0];
  const happyProposal = await propose(happy);
  await scenario("PROPOSAL_CREATES_NO_BOOKING_OR_MANDATE", async () => {
    const before = await state(happyProposal.id);
    assert.equal(before.proposal.status, "pending");
    assert.equal(before.mandates, 0);
    assert.equal(before.bookings, 0);
    assert.equal(before.inbox.consumedAt, null);
    assert.equal((await book(happy, undefined)).body!.error.code, "mandate_required");
  });

  await scenario("CUSTOMER_PAGE_SHOWS_EXACT_TERMS_AND_OPENING_APPROVES_NOTHING", async () => {
    const view = await openConsent(customerBrowser, await inboxLink(happyProposal.id));
    try {
      assert.equal(view.state, "ready");
      const expected = await expectedText(view.page, { start: happy.start, expiresAt: happyProposal.expiresAt,
        amountMinor: service.price.amountMinor, currency: service.price.currency, timeZone });
      assert.deepEqual(view.terms, {
        customer: customerLabel, salon: catalog.business.name, location: salon.locationName, service: service.name,
        staff: happy.staff.name, date: expected.date, time: expected.time, "time-zone": timeZone,
        duration: `${service.durationMinutes} minutes`, price: expected.price, currency: service.price.currency, expires: expected.expires,
      });
      // Independent of Intl: the wall-clock time in the salon's zone.
      assert.equal(view.terms.time, DateTime.fromISO(happy.start).setZone(timeZone).toFormat("HH:mm"));
      assert.equal(timeZone, "Europe/Stockholm");
      assert.equal(view.buttons, 2);
      const after = await state(happyProposal.id);
      assert.equal(after.proposal.status, "pending");
      assert.equal(after.mandates, 0);
      assert.equal(after.inbox.consumedAt, null);
      await decide(view, "approve");
    } finally { await close(view); }
    const approved = await state(happyProposal.id);
    assert.equal(approved.proposal.status, "approved");
    assert.equal(approved.mandates, 1);
    assert.notEqual(approved.inbox.consumedAt, null);
  });

  await scenario("AGENT_READS_APPROVAL_AND_BOOKS_WITH_IDEMPOTENT_REPLAY", async () => {
    const read = await status(happyProposal.id);
    assert.equal(read.status, "approved");
    const key = randomUUID();
    const first = await book(happy, read.mandateId, key);
    assert.equal(first.isError, false);
    bookingId = first.body!.booking.id;
    const replay = await book(happy, read.mandateId, key);
    assert.equal(replay.body!.replayed, true);
    assert.equal(replay.body!.booking.id, bookingId);
    assert.equal((await agent.call("get_booking", { bookingId })).body!.booking.id, bookingId);
    assert.equal(await operator.agentBooking.count({ where: { mandateId: read.mandateId } }), 1);
    const mandate = await operator.agentMandate.findUniqueOrThrow({ where: { id: read.mandateId } });
    assert.equal(mandate.verifiedVia, "separate-staging-v1");
  });

  await scenario("OWNER_OPENS_EXACT_BOOKING_IN_AUTHENTICATED_CALENDAR", async () => {
    assert(bookingId);
    const email = `owner-${randomUUID()}@example.test`, password = randomUUID() + randomUUID();
    registerSecret(password);
    const owner = await createAdminUser(email, password);
    try {
      const anonymous = await operatorFetch(tls.ca, `${salonOrigin}/admin?view=day&date=${DateTime.fromISO(happy.start).setZone(timeZone).toISODate()}`);
      assert(!anonymous.text.includes(bookingId));
      await ownerOpensBooking(ownerBrowser, salonOrigin, DateTime.fromISO(happy.start).setZone(timeZone).toISODate()!, bookingId, email, password);
    } finally {
      await operator.$transaction([operator.adminSession.deleteMany({ where: { userId: owner.id } }), operator.adminUser.delete({ where: { id: owner.id } })]);
    }
  });

  await scenario("ALREADY_USED_LINK_SHOWS_STATE_AND_GRANTS_NOTHING", async () => {
    const view = await openConsent(customerBrowser, links[0]);
    try {
      assert.equal(view.state, "used");
      assert.equal(view.buttons, 0);
      assert.deepEqual(view.terms, {});
    } finally { await close(view); }
    assert.equal((await state(happyProposal.id)).mandates, 1);
  });

  await scenario("DECLINE_LEAVES_NO_MANDATE", async () => {
    const proposal = await propose(slots[1]);
    const view = await openConsent(customerBrowser, await inboxLink(proposal.id));
    try { assert.equal(view.state, "ready"); await decide(view, "decline"); } finally { await close(view); }
    const read = await status(proposal.id);
    assert.equal(read.status, "declined");
    assert(!("mandateId" in read));
    assert.equal((await state(proposal.id)).mandates, 0);
  });

  await scenario("EXPIRED_LINK_SHOWS_STATE_AND_GRANTS_NOTHING", async () => {
    const proposal = await propose(slots[1]);
    const link = await inboxLink(proposal.id);
    await operator.agentProposal.update({ where: { id: proposal.id, clientId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const view = await openConsent(customerBrowser, link);
    try { assert.equal(view.state, "expired"); assert.equal(view.buttons, 0); } finally { await close(view); }
    const read = await status(proposal.id);
    assert.equal(read.status, "expired");
    assert(!("mandateId" in read));
    assert.equal((await state(proposal.id)).mandates, 0);
  });

  await scenario("CHANGED_PRICE_REFUSES_BOOKING", async () => {
    const mandateId = await approveInBrowser((await propose(slots[1])).id);
    await operator.service.update({ where: { id: service.id }, data: { priceOre: service.price.amountMinor - 5000 } });
    try {
      const result = await book(slots[1], mandateId);
      assert.equal(result.isError, true);
      assert.equal(result.body!.error.code, "mandate_denied");
    } finally { await operator.service.update({ where: { id: service.id }, data: { priceOre: service.price.amountMinor } }); }
  });

  await scenario("SLOT_TAKEN_REFUSES_BOOKING", async () => {
    const mandateId = await approveInBrowser((await propose(slots[2])).id);
    await createBooking({ serviceId: service.id, staffId: slots[2].staff.id, start: slots[2].start, customerName: "Fictional Visitor", customerEmail: "visitor@example.test" });
    const result = await book(slots[2], mandateId);
    assert.equal(result.isError, true);
    assert.equal(result.body!.error.code, "slot_unavailable");
  });

  await scenario("AGENT_CANNOT_REACH_INBOX_OR_SALON_DIRECTLY", async () => {
    for (const path of ["/api/v1/consent-inbox", "/api/v1/inbox", `/consent/${happyProposal.id}/decision`]) {
      const response = await operatorFetch(tls.ca, gatewayOrigin + path, { headers: { authorization: `Bearer ${agentKey.key}` } });
      assert.equal(response.status, 404);
    }
    assert.equal((await operatorFetch(tls.ca, `${salonOrigin}/api/v1/mcp`, { method: "POST" })).status, 404);
    const direct = await operatorFetch(tls.ca, `${salonOrigin}/api/v1/proposals/${happyProposal.id}`, { headers: { authorization: `Bearer ${agentKey.key}` } });
    assert.equal(direct.status, 401);
    // The customer endpoint refuses agent credentials even with the right origin.
    const decision = await operatorFetch(tls.ca, `${salonOrigin}/consent/${happyProposal.id}/decision`, { method: "POST",
      headers: { origin: salonOrigin, "content-type": "application/json", authorization: `Bearer ${agentKey.key}` }, body: "{}" });
    assert.equal(decision.status, 403);
  });

  await scenario("NO_LINK_OR_SECRET_IN_AGENT_RESPONSES_OR_PROCESS_OUTPUT", async () => {
    assert(links.length >= 5);
    const transcript = agentTranscript.join("\n");
    assert(!containsSecret(transcript), "agent transcript");
    for (const value of ["/consent/", salonHost, STAGING_CUSTOMER.id, "approvalUrl", "approvalLink"]) assert(!transcript.includes(value));
    for (const [name, output] of Object.entries(captured)) assert(!containsSecret(output), `${name} output`);
  });
} catch {
  failures++;
  say(`FAIL ${step}`);
} finally {
  await cleanup();
  say(`RESULT ${failures ? "FAILED" : "PASSED"} - ${results.length} checks passed, ${failures} failed`);
  process.exitCode = failures ? 1 : 0;
}
