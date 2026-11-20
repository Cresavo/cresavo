// Staging run of the split-mode customer consent channel over HTTPS, isolated on this
// machine: a new PostgreSQL _test database, the split salon, the real gateway from a
// separate checkout, and per-run TLS in front of both. See docs/CUSTOMER_CONSENT_CHANNEL.md.
// No .env loading. Prints sanitized results only. Never commit its output unreviewed.
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { isIP } from "node:net";
import { dirname, join, resolve, sep } from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { DateTime } from "luxon";
import { assertTestDatabase } from "../test-db-guard.mjs";
import { createDatabaseClient } from "../database.mjs";
import { containsSecret, registerSecret, say } from "./sanitize.mjs";
import { captureStream, freePorts, guardStream, leakedStreams, runStep, startServer, stopAll, track } from "./processes.mjs";
import { agentChannel } from "./agent-reply.mjs";
import { loopbackAdminUrl, refuseDiagnostics, refuseRemoteBrowsers } from "./preflight.mjs";
import { acquisition, CLEANUP_SIGNALS, databaseAlreadyExisted, launchedBrowsers, settles } from "./lifecycle.mjs";
import { issueCertificates, operatorFetch, tlsProxy } from "./tls.mjs";
import { createServer as createHttpServer } from "node:http";
import { approveWithLostResponse, close, decide, expectedText, launchBrowser, openConsent, ownerOpensBooking, reopenInSameTab, salonContext } from "./browsers.mjs";

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
// Failing until the run has finished, cleaned up and passed every check.
process.exitCode = 1;
// Before any link exists: diagnostics that would print URLs outside the sanitizer are refused.
refuseDiagnostics(process.env, process.execArgv);
refuseRemoteBrowsers(process.env);
// Throws a static code only: the value may hold a password and nothing is registered for redaction yet.
const adminUrl = loopbackAdminUrl(process.env.STAGING_PG_ADMIN_URL);
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
// Said, not silently skipped: a short password is only checked where a credential stands.
if (adminUrl.password && decodeURIComponent(adminUrl.password).length < 8)
  say("NOTE DATABASE_PASSWORD_SHORT - checked in credential contexts only (URL, password=...); use 8 or more characters for a full scan");
const serviceToken = randomBytes(32).toString("hex"), sessionSecret = randomBytes(32).toString("hex");
registerSecret(serviceToken); registerSecret(sessionSecret);
const baseEnv = { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? temp, TMPDIR: temp, LANG: "en_US.UTF-8", NEXT_TELEMETRY_DISABLED: "1", CHECKPOINT_DISABLE: "1" };
const dnsHook = join(repo, "scripts/staging-consent/loopback-dns.mjs");
// Outbound settings for the two install/build steps only (registry, fonts). Never given to a server.
const networkEnv = Object.fromEntries(["HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy", "NO_PROXY", "no_proxy",
  "npm_config_https_proxy", "npm_config_noproxy", "npm_config_registry", "NPM_CONFIG_USERCONFIG", "NODE_EXTRA_CA_CERTS", "SSL_CERT_FILE"]
  .flatMap(name => process.env[name] === undefined ? [] : [[name, process.env[name]!]]));
const database = acquisition();
// Launches are tracked while pending: a signal during a launch still closes that browser.
const browsers = launchedBrowsers<Awaited<ReturnType<typeof launchBrowser>>>();
const servers: { close(): void }[] = [];
let db: typeof import("../../src/lib/db").db | undefined;

// Without --skip-build the salon is built and served from a copy inside the run directory:
// the tracked and untracked (not ignored) files of the working tree, and node_modules as hard
// links where the file system allows (a copy otherwise). Nothing in the repository is written.
const skipBuild = process.argv.includes("--skip-build");
const salonDir = skipBuild ? repo : join(temp, "salon");
function isolatedCheckout(dest: string) {
  mkdirSync(dest, { mode: 0o700 });
  const files = execFileSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { cwd: repo, stdio: ["ignore", "pipe", "ignore"] })
    .toString("utf8").split("\0").filter(Boolean);
  for (const file of new Set(files)) {
    const from = join(repo, file), to = join(dest, file);
    if (!existsSync(from)) continue;
    mkdirSync(dirname(to), { recursive: true });
    cpSync(from, to, { verbatimSymlinks: true });
  }
  try { execFileSync("cp", ["-al", join(repo, "node_modules"), join(dest, "node_modules")], { stdio: "ignore" }); }
  catch {
    rmSync(join(dest, "node_modules"), { recursive: true, force: true });
    cpSync(join(repo, "node_modules"), join(dest, "node_modules"), { recursive: true, verbatimSymlinks: true });
  }
}

// Only CREATE/DROP of this run's own generated name, outside a transaction.
async function adminQuery(sql: string) {
  const client = createDatabaseClient(adminUrl.href, 1);
  try { await client.$executeRawUnsafe(sql); } finally { await client.$disconnect(); }
}

let cleaned: Promise<void> | undefined;
// Once only, whichever of the main flow and a signal gets here first.
const cleanup = () => (cleaned ??= cleanupOnce());
async function cleanupOnce() {
  await browsers.closeAll();
  for (const server of servers) server.close();
  // Stops the salon, gateway and agent, and waits until each has closed its streams.
  await stopAll();
  // Scan the complete output, including the shutdown, and the final agent transcript.
  const leaks = leakedStreams();
  if (containsSecret(agentTranscript.join("\n"))) leaks.push("agent:transcript");
  if (leaks.length) { failures++; say(`FAIL PROCESS_OUTPUT_SECRET_FREE_THROUGH_SHUTDOWN - ${leaks.length} stream(s)`); }
  else pass("PROCESS_OUTPUT_SECRET_FREE_THROUGH_SHUTDOWN");
  await db?.$disconnect().catch(() => {});
  // A cancellation during CREATE DATABASE waits for it: the database may exist although the call
  // has not returned yet. DROP ... IF EXISTS is harmless when it was never created.
  if (await database.settled()) {
    try { await adminQuery(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`); say("PASS DATABASE_DROPPED"); }
    catch { failures++; say("FAIL DATABASE_DROP"); }
  }
  try { rmSync(temp, { recursive: true, force: true }); } catch { /* reported just below */ }
  if (existsSync(temp)) { failures++; say("FAIL TEMP_DIRECTORY_REMOVED"); } else say("PASS TEMP_DIRECTORY_REMOVED");
}
for (const signal of CLEANUP_SIGNALS)
  process.once(signal, () => { void cleanup().finally(() => process.exit(130)); });
// Node's default report would print the error, which can quote a URL or a response. A static
// code instead, then the normal cleanup.
// The main flow keeps running and its `finally` cleans up: cleaning up here as well would close
// browsers and servers under a scenario that is still running.
let crashed = false;
for (const event of ["uncaughtException", "unhandledRejection"] as const)
  process.on(event, () => {
    if (crashed) return;
    crashed = true; failures++; process.exitCode = 1; say("FAIL UNCAUGHT_ERROR");
  });

const agentTranscript: string[] = [];
function agentClient(env: Record<string, string>) {
  const child = track(spawn(process.execPath, ["--import", "tsx", "--import", dnsHook, join(repo, "scripts/staging-consent/agent.mts")],
    { cwd: repo, env: env as NodeJS.ProcessEnv, stdio: ["pipe", "pipe", "pipe"], detached: true }));
  captureStream("agent:stderr", child.stderr);
  child.stdin.on("error", () => {});
  const channel = agentChannel(line => child.stdin.write(line), agentTranscript);
  child.stdout.setEncoding("utf8");
  // Counted against the shared output budget before readline buffers or the transcript keeps
  // anything: past it the agent is stopped and the final scan reports incomplete output.
  guardStream(child.stdout, () => { child.kill("SIGKILL"); channel.failAll("AGENT_OUTPUT_TOO_LARGE"); });
  createInterface({ input: child.stdout }).on("line", channel.receive);
  child.on("exit", () => channel.failAll("AGENT_EXITED"));
  return { child, call: (name: string, args: Record<string, unknown>) => channel.send({ name, args }), list: () => channel.send({ list: true }) };
}

try {
  // ---- Database ----
  step = "DATABASE";
  // A name that already exists (42P04) proves this run created nothing: cleanup must not drop it.
  await database.run(() => adminQuery(`CREATE DATABASE "${dbName}"`), databaseAlreadyExisted);
  // Live check of that rule with the role that just created it (the ordinary integration suite
  // may run without CREATEDB): creating the same name again is recognised as already existing.
  const duplicate = await adminQuery(`CREATE DATABASE "${dbName}"`).then(() => null, (error: unknown) => error);
  assert(duplicate !== null && databaseAlreadyExisted(duplicate), "STAGING_DUPLICATE_DATABASE_NOT_RECOGNISED");
  const dbEnv = { ...baseEnv, DATABASE_URL: databaseUrl.href, SESSION_SECRET: sessionSecret };
  await runStep("MIGRATE", process.execPath, [join(repo, "node_modules/prisma/build/index.js"), "migrate", "deploy"], repo, dbEnv);
  await runStep("SEED", process.execPath, ["--import", "tsx", "prisma/seed.ts"], repo, dbEnv);
  pass("ISOLATED_TEST_DATABASE", "new uniquely named _test database, migrated and seeded; a taken name is never dropped");
  if (!skipBuild) {
    // Build and serve a disposable copy of the working tree, so the operator's own .next stays untouched.
    step = "BUILD";
    isolatedCheckout(salonDir);
    await runStep("BUILD", process.execPath, [join(salonDir, "node_modules/next/dist/bin/next"), "build"], salonDir, { ...dbEnv, ...networkEnv, NODE_ENV: "production" }, 900_000);
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
  // Four distinct ports chosen together: the two HTTP children and their two TLS proxies. A proxy
  // binding port 0 could otherwise take a port reserved for a child that has not bound it yet.
  const [salonPort, gatewayPort, salonTlsPort, gatewayTlsPort] = await freePorts(4);
  // Each listener is in the cleanup list as soon as it exists, before the next one can fail.
  const salonTls = await tlsProxy(tls.leaves[salonHost], salonPort, "x-real-ip", salonTlsPort);
  servers.push(salonTls.server);
  const gatewayTls = await tlsProxy(tls.leaves[gatewayHost], gatewayPort, "x-forwarded-for", gatewayTlsPort);
  servers.push(gatewayTls.server);
  const salonOrigin = `https://${salonHost}:${salonTls.port}`, gatewayOrigin = `https://${gatewayHost}:${gatewayTls.port}`;
  await startServer("salon", process.execPath, ["scripts/server.mjs"], salonDir, {
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
  const { STAGING_CUSTOMER, openInboxLink } = await import("../../src/lib/agent-api/consent-staging");
  const operator = db;
  const agentKey = await createAgentApiKey({ businessId: "demo", agentName: "Fictional staging assistant",
    ownerName: "Fictional operator", ownerContact: "operator@example.test", kind: "demo-script" }, operator);
  registerSecret(agentKey.key);
  const clientId = agentKey.record.clientId;
  // What the agent process is given: the gateway's origin and its own key, nothing of the salon.
  // It still runs as the operator's OS user on this machine, so this limits its configuration,
  // not what the operating system would let it reach; the API checks below test the boundary.
  const agentEnv = { PATH: baseEnv.PATH, HOME: baseEnv.HOME, NODE_EXTRA_CA_CERTS: tls.caPath, STAGING_LOOPBACK_HOSTS: gatewayHost,
    STAGING_AGENT_GATEWAY: gatewayOrigin, STAGING_AGENT_KEY: agentKey.key };
  const agent = agentClient(agentEnv);
  // Each launch is tracked from its start, so cleanup closes its browser even if it is still pending.
  const customerBrowser = await browsers.start(() => launchBrowser(salonHost, salonTls.port, tls.leaves[salonHost].spki));
  const ownerBrowser = await browsers.start(() => launchBrowser(salonHost, salonTls.port, tls.leaves[salonHost].spki));
  const links: string[] = [];
  async function inboxLink(proposalId: string) {
    const message = await operator.consentInboxMessage.findUniqueOrThrow({ where: { proposalId } });
    assert.equal(message.recipientId, STAGING_CUSTOMER.id);
    // The database holds only the sealed link; the operator opens it with the run's session secret.
    const link = openInboxLink(message.sealedLink, proposalId, sessionSecret);
    const url = new URL(link);
    assert.equal(url.origin, salonOrigin);
    assert.equal(url.pathname, `/consent/${proposalId}`);
    assert.match(url.hash, /^#[A-Za-z0-9_-]{43}$/);
    registerSecret(link); registerSecret(url.hash.slice(1));
    assert(!message.sealedLink.includes(url.hash.slice(1)) && !message.sealedLink.includes("/consent/"), "the inbox row holds the link in the clear");
    links.push(link);
    return link;
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
      // A used link names the recorded decision, nothing else: no terms, no buttons.
      assert.equal(view.state, "approvedEarlier");
      assert.equal(view.buttons, 0);
      assert.deepEqual(view.terms, {});
    } finally { await close(view); }
    assert.equal((await state(happyProposal.id)).mandates, 1);
  });

  // The gateway allows 5 proposals per client address per hour: the runner creates exactly 5
  // (happy path, decline, expired, changed price, slot taken), so checks share proposals.
  await scenario("DECLINE_LEAVES_NO_MANDATE_AND_SAME_TAB_REOPEN_READS_AGAIN", async () => {
    const proposal = await propose(slots[1]);
    const link = await inboxLink(proposal.id);
    // First a wrong secret for the same proposal, then the real link in the same tab: a
    // fragment-only navigation the page must notice, reading the proposal again.
    const view = await openConsent(customerBrowser, `${link.split("#")[0]}#${"A".repeat(43)}`);
    try {
      assert.equal(view.state, "unchecked");
      assert.equal(view.buttons, 0);
      const again = await reopenInSameTab(view, link, "ready");
      assert.equal(again.buttons, 2);
      assert.equal(again.terms.service, service.name);
      await decide(again, "decline");
    } finally { await close(view); }
    const read = await status(proposal.id);
    assert.equal(read.status, "declined");
    assert(!("mandateId" in read));
    // Opened again, the spent link says it was declined.
    const reopened = await openConsent(customerBrowser, link);
    try { assert.equal(reopened.state, "declinedEarlier"); assert.equal(reopened.buttons, 0); } finally { await close(reopened); }
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

  await scenario("LOST_APPROVAL_RESPONSE_IS_RESOLVED_BY_CHECKING_STATUS_AND_CHANGED_PRICE_REFUSES_BOOKING", async () => {
    const proposal = await propose(slots[1]);
    const view = await openConsent(customerBrowser, await inboxLink(proposal.id));
    try { assert.equal(view.state, "ready"); await approveWithLostResponse(view); } finally { await close(view); }
    const read = await status(proposal.id);
    assert.equal(read.status, "approved");
    const mandateId = read.mandateId as string;
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

  await scenario("AGENT_PROCESS_IS_GIVEN_ONLY_THE_GATEWAY_ORIGIN_AND_ITS_KEY", async () => {
    assert.deepEqual(Object.keys(agentEnv).sort(),
      ["HOME", "NODE_EXTRA_CA_CERTS", "PATH", "STAGING_AGENT_GATEWAY", "STAGING_AGENT_KEY", "STAGING_LOOPBACK_HOSTS"]);
    const given = JSON.stringify(agentEnv);
    for (const value of [databaseUrl.href, adminUrl.href, sessionSecret, serviceToken, salonOrigin, salonHost])
      assert(!given.includes(value), "the agent was given a salon or database setting");
  });

  // The HTTP boundary only: through the gateway, or at the salon with an agent key, there is no
  // route to the inbox or the customer decision. (Not OS-level isolation of the agent process.)
  await scenario("API_BOUNDARY_GIVES_AGENT_NO_INBOX_OR_DECISION_ROUTE", async () => {
    for (const path of ["/api/v1/consent-inbox", "/api/v1/inbox", `/consent/${happyProposal.id}/decision`]) {
      const response = await operatorFetch(tls.ca, gatewayOrigin + path, { headers: { authorization: `Bearer ${agentKey.key}` } });
      assert.equal(response.status, 404);
    }
    // The decision endpoint is POST-only: probe the gateway with the method the page uses and a
    // synthetic secret, with and without agent credentials, from no origin, the gateway's own and
    // the salon's. Each answer must be the gateway's own refusal (its error codes), never the
    // salon's `consent_denied`, which would mean the request had been forwarded.
    const before = await state(happyProposal.id);
    for (const origin of [undefined, gatewayOrigin, salonOrigin])
      for (const authorization of [undefined, `Bearer ${agentKey.key}`]) {
        const forwarded = await operatorFetch(tls.ca, `${gatewayOrigin}/consent/${happyProposal.id}/decision`, { method: "POST",
          headers: { "content-type": "application/json", ...(origin ? { origin } : {}), ...(authorization ? { authorization } : {}) },
          body: JSON.stringify({ token: "Z".repeat(43), decision: "no", proposalHash: "0".repeat(64) }) });
        const code = (JSON.parse(forwarded.text) as { error?: { code?: string } }).error?.code;
        assert(!forwarded.text.includes("consent_denied"), "decision reached the salon");
        // A foreign Origin is refused first; otherwise the route is unknown to the gateway.
        if (origin === salonOrigin) assert.deepEqual([forwarded.status, code], [403, "forbidden_origin"]);
        else assert.deepEqual([forwarded.status, code], [404, "not_found"]);
      }
    const after = await state(happyProposal.id);
    assert.equal(after.proposal.status, before.proposal.status);
    assert.equal(after.mandates, before.mandates);
    assert.equal((await operatorFetch(tls.ca, `${salonOrigin}/api/v1/mcp`, { method: "POST" })).status, 404);
    const direct = await operatorFetch(tls.ca, `${salonOrigin}/api/v1/proposals/${happyProposal.id}`, { headers: { authorization: `Bearer ${agentKey.key}` } });
    assert.equal(direct.status, 401);
    // The customer endpoint refuses agent credentials even with the right origin.
    const decision = await operatorFetch(tls.ca, `${salonOrigin}/consent/${happyProposal.id}/decision`, { method: "POST",
      headers: { origin: salonOrigin, "content-type": "application/json", authorization: `Bearer ${agentKey.key}` }, body: "{}" });
    assert.equal(decision.status, 403);
  });

  await scenario("CUSTOMER_BROWSER_REACHES_ONLY_THE_SALON_ORIGIN", async () => {
    // A real loopback listener that would answer if the browser could reach it.
    let hits = 0;
    const probe = createHttpServer((_req, res) => { hits++; res.end("reached"); });
    await new Promise<void>((resolveListen, reject) => { probe.once("error", reject); probe.listen(0, "127.0.0.1", resolveListen); });
    // On the runner's cleanup list at once: a browser failure below must not leave it listening.
    servers.push(probe);
    const probePort = (probe.address() as { port: number }).port;
    let context: Awaited<ReturnType<typeof salonContext>> | undefined;
    try {
      context = await salonContext(customerBrowser, salonOrigin);
      const page = await context.newPage();
      page.setDefaultTimeout(10_000);
      // Direct navigation: an IP literal, localhost, the gateway, the salon's own plain port.
      for (const url of [`http://127.0.0.1:${probePort}/`, `http://localhost:${probePort}/`, `${gatewayOrigin}/`, `http://127.0.0.1:${salonPort}/`,
        // The salon's own host name on another port: the browser is pinned to the salon's TLS port.
        `http://${salonHost}:${probePort}/`, `https://${salonHost}:${gatewayTls.port}/`])
        await assert.rejects(page.goto(url), `navigation to ${new URL(url).host} was allowed`);
      // A redirect from the salon origin to elsewhere, secret-shaped fragment included. A route
      // handler never sees the redirect target, so this checks the browser's own refusal.
      for (const location of [`http://127.0.0.1:${probePort}/leak#${"Z".repeat(43)}`, `http://${salonHost}:${probePort}/leak#${"Z".repeat(43)}`]) {
        await page.route(`${salonOrigin}/redirect-probe`, route => route.fulfill({ status: 302, headers: { location } }));
        await assert.rejects(page.goto(`${salonOrigin}/redirect-probe`));
        await page.unroute(`${salonOrigin}/redirect-probe`);
      }
      assert.equal(hits, 0, "a non-salon destination was reached");
    } finally {
      await context?.close().catch(() => {});
      await new Promise<void>(resolveClose => probe.close(() => resolveClose()));
    }
  });

  await scenario("NO_LINK_OR_SECRET_IN_AGENT_RESPONSES_OR_PROCESS_OUTPUT", async () => {
    assert(links.length >= 5);
    const transcript = agentTranscript.join("\n");
    assert(!containsSecret(transcript), "agent transcript");
    for (const value of ["/consent/", salonHost, STAGING_CUSTOMER.id, "approvalUrl", "approvalLink"]) assert(!transcript.includes(value));
    // Output so far; the complete output is scanned again after every process has exited.
    assert.deepEqual(leakedStreams(), [], "process output");
  });
} catch (error) {
  failures++;
  say(`FAIL ${step}${process.env.STAGING_DEBUG === "1" ? " - " + String((error as Error)?.message) : ""}`);
} finally {
  // A cleanup that throws is a failure too: the exit status stays 1 unless it settled and every
  // check passed (set to 1 at start, in preflight).
  if (!(await settles(cleanup))) { failures++; say("FAIL CLEANUP"); }
  say(`RESULT ${failures ? "FAILED" : "PASSED"} - ${results.length} checks passed, ${failures} failed`);
  process.exitCode = failures ? 1 : 0;
}
