// Explicit opt-in acceptance using the installed, already authenticated Codex CLI.
// This is a test consumer of native HTTP MCP, not a new product integration.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { DateTime } from "luxon";
import { db } from "../../src/lib/db";
import { createAgentApiKey, revokeAgentApiKey } from "../../src/lib/agent-api/keys";
import { assertTestDatabase } from "../test-db-guard.mjs";
import { cleanupRun } from "./fixtures.mjs";
import { checkSalonCalendar } from "./salon-calendar.mjs";
import { mcpCall, safeCall, safeNote } from "./codex-events.mjs";
import { EMAIL_CODE_CHANNEL } from "../../src/lib/agent-api/email-code-consent";

// The synthetic customer who proves their address with the e-mail code on the consent page.
const CUSTOMER = Object.freeze({ name: "Syntetisk Kodkund", email: "codex-customer@example.test" });

type Call = NonNullable<ReturnType<typeof mcpCall>>;
const tools = ["list_services", "get_availability", "create_proposal", "get_proposal", "create_booking", "get_booking"];

async function client(origin: string, credential: string, cwd: string, prompt: string) {
  const env: NodeJS.ProcessEnv = { NODE_ENV: "production", ...Object.fromEntries(["PATH", "SystemRoot", "SYSTEMROOT", "TEMP", "TMP", "USERPROFILE", "HOME",
    "APPDATA", "LOCALAPPDATA", "CODEX_HOME"].flatMap(n => process.env[n] === undefined ? [] : [[n, process.env[n]!]])) };
  env.BOOKING_PROOF_KEY = credential;
  assert(!env.DATABASE_URL && !env.SESSION_SECRET && !env.GATEWAY_SERVICE_TOKEN);
  const config = {
    "approval_policy": '"never"', "features.shell_tool": "false", "features.shell_snapshot": "false",
    "features.view_image": "false", "web_search": '"disabled"', "analytics.enabled": "false",
    "apps._default.enabled": "false", "model_reasoning_effort": '"low"',
    "shell_environment_policy.filters": '{ "BOOKING_PROOF_KEY" = "exclude" }',
    "mcp_servers.bookingproof.url": JSON.stringify(origin + "/api/v1/mcp"),
    "mcp_servers.bookingproof.bearer_token_env_var": '"BOOKING_PROOF_KEY"',
    "mcp_servers.bookingproof.required": "true",
    "mcp_servers.bookingproof.enabled_tools": JSON.stringify(tools),
    // This invocation approves only the six explicitly allowlisted synthetic
    // test tools. Server-side key, scope and customer mandate checks still apply.
    "mcp_servers.bookingproof.default_tools_approval_mode": '"approve"',
  };
  const args = ["exec", "--ignore-user-config", "--strict-config", "--ephemeral", "--skip-git-repo-check",
    "--sandbox", "read-only", "--json", "--color", "never",
    ...Object.entries(config).flatMap(([k, v]) => ["-c", `${k}=${v}`]), "-"];
  return new Promise<{ calls: Call[]; notes: string[] }>((resolveClient, reject) => {
    const child = spawn("codex", args, { cwd, env, stdio: ["pipe", "pipe", "pipe"] });
    let buffer = "", invalid = false;
    const calls: Call[] = [];
    const notes: string[] = [];
    const categories = new Set<string>();
    const timer = setTimeout(() => child.kill(), 180000);
    child.on("error", () => { clearTimeout(timer); reject(new Error("NATIVE_CLI_START_FAILED")); });
    child.stdout.on("data", chunk => {
      buffer += String(chunk);
      for (let end; (end = buffer.indexOf("\n")) >= 0;) {
        const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
        try {
          const event = JSON.parse(line);
          if (event.type === "item.completed" && event.item?.type === "agent_message")
            notes.push(safeNote(event.item.text, credential));
          if (["command_execution", "file_change"].includes(event.item?.type)) invalid = true;
          const call = mcpCall(event);
          if (call) { if (!tools.includes(call.tool)) invalid = true; calls.push(call); }
        } catch { invalid = true; }
      }
      if (buffer.length > 2_000_000) { invalid = true; child.kill(); }
    });
    // Never persist stderr, approval links or raw tool results.
    // Final model notes are separately redacted and bounded above.
    child.stderr.on("data", chunk => {
      const text = String(chunk);
      for (const code of ["config", "usage_limit", "quota", "authentication", "sandbox", "MCP", "network"])
        if (text.toLowerCase().includes(code.toLowerCase())) categories.add(code);
    });
    child.on("close", code => {
      clearTimeout(timer);
      if (code !== 0 || invalid) {
        console.error("NATIVE_CLI_FAILURE " + JSON.stringify({ exit: code, invalid, categories: [...categories] }));
        reject(new Error("NATIVE_CLI_FAILED"));
      } else resolveClient({ calls, notes });
    });
    child.stdin.end("You are a booking customer assistant, not a coding agent. Use only bookingproof MCP tools. " +
      "Do not use shell, files, HTTP scripts, other plugins or delegation. Do not print approval URLs or credentials. " + prompt);
  });
}

export async function runNativeCodexProof(gateway: string, salon: string, pair: {
  salon: { sha: string; dirty: boolean }; gateway: { sha: string; dirty: boolean };
}, customerInbox: string) {
  assertTestDatabase();
  assert(!process.env.CI && !process.env.VERCEL && !process.env.VERCEL_ENV);
  for (const origin of [gateway, salon]) assert.equal(new URL(origin).hostname, "127.0.0.1");
  const run = `agentprov-${randomUUID()}`;
  const tempRoot = resolve(tmpdir());
  const cwd = mkdtempSync(join(tempRoot, "booking-native-client-"));
  const output = resolve("test-results/native-codex");
  mkdirSync(output, { recursive: true });
  const trace: ReturnType<typeof safeCall>[] = [];
  const notes: string[] = [];
  const checks: string[] = [];
  let step = "NATIVE_AUTHENTICATED_CLIENT";
  let key: Awaited<ReturnType<typeof createAgentApiKey>> | undefined;
  let bookingId: string | undefined;
  let cleaned = false;
  const cliVersion = spawnSync("codex", ["--version"], { encoding: "utf8", timeout: 10000 }).stdout?.trim();
  assert(cliVersion && /^codex-cli [0-9.]+$/.test(cliVersion), "NATIVE_CLIENT_VERSION_REQUIRED");
  const pass = (code: string) => { checks.push(code); console.log("PASS " + code); };
  try {
    const login = spawnSync("codex", ["login", "status"], { encoding: "utf8", timeout: 10000 });
    assert(login.status === 0 && (login.stdout + login.stderr).includes("ChatGPT"), "NATIVE_EXISTING_CHATGPT_LOGIN_REQUIRED");
    key = await createAgentApiKey({ businessId: "demo", agentName: `${run}-codex`,
      ownerName: "Synthetic proof operator", ownerContact: "operator@example.test", kind: "registered-client" }, db);
    const call = (method: string, path: string, body?: unknown) => fetch(new URL(path, gateway), {
      method, redirect: "error", headers: { authorization: `Bearer ${key!.key}`, "content-type": "application/json",
        "idempotency-key": randomUUID() }, ...(body ? { body: JSON.stringify(body) } : {}),
    });
    let day = DateTime.now().setZone("Europe/Stockholm").plus({ days: 1 }).startOf("day");
    while (day.weekday > 5) day = day.plus({ days: 1 });
    step = "NATIVE_AGENT_PREPARES_PROPOSAL";
    const prepared = await client(gateway, key.key, cwd,
      `Find a Massage with Anna in business demo on ${day.toISODate()}, Europe/Stockholm, lasting 30 minutes and costing at most SEK 450. ` +
      "Read services and availability, choose one available start, and create exactly one proposal for synthetic customer approval. " +
      "Do not create any booking yet. Stop after the proposal. Report its id only.");
    const prepare = prepared.calls;
    notes.push(...prepared.notes); trace.push(...prepare.map(safeCall));
    for (const tool of ["list_services", "get_availability", "create_proposal"]) assert(prepare.some(c => c.tool === tool && !c.failed));
    assert(!prepare.some(c => c.tool === "create_booking"));
    const proposals = prepare.filter(c => c.tool === "create_proposal" && !c.failed);
    assert.equal(proposals.length, 1);
    const proposed = proposals[0].result;
    assert.equal(proposed.approvalRequired, true);
    assert.equal(proposed.approvalDelivery, "customer-email-code");
    assert(!("approvalUrl" in proposed));
    // The consent link may reach the agent: it carries no secret.
    const consentUrl = new URL(proposed.consentUrl);
    assert.equal(consentUrl.hash, ""); assert.equal(consentUrl.search, "");
    const row = await db.agentProposal.findUniqueOrThrow({ where: { id: proposed.proposal.id } });
    assert.equal(row.clientId, key.record.clientId); assert.equal(row.status, "pending");
    assert.equal(row.serviceId, "massage"); assert.equal(row.staffId, "staff-demo");
    assert.equal(row.duration, 30); assert(row.priceOre <= 45000);
    assert.equal(row.consentDelivery, EMAIL_CODE_CHANNEL);
    assert.equal(DateTime.fromJSDate(row.startsAt).setZone("Europe/Stockholm").toISODate(), day.toISODate());
    const payload = { business: "demo", serviceId: row.serviceId, serviceVersion: row.serviceVersion,
      staffId: row.staffId, start: row.startsAt.toISOString(), confirmed: true,
      customer: { name: CUSTOMER.name, email: CUSTOMER.email } };
    step = "NATIVE_UNAPPROVED_BOOKING_DENIED";
    const denied = await call("POST", "/api/v1/bookings", payload);
    assert.equal(denied.status, 400);
    assert.equal((await denied.json()).error.code, "mandate_required");
    assert.equal(await db.agentBooking.count({ where: { clientId: row.clientId } }), 0);
    pass("NATIVE_PROPOSAL_WITHOUT_BOOKING");
    step = "SYNTHETIC_CUSTOMER_APPROVAL";
    // The customer opens the consent link, types their own address and reads the code from their
    // inbox: the operator's private directory. The CLI never receives the directory or the code.
    assert.equal(consentUrl.origin, salon); assert.equal(consentUrl.pathname, "/consent/" + row.id);
    const receiptPath = join(customerInbox, row.id + ".json");
    let customerCode = "";
    const { chromium } = await import("@playwright/test");
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      await page.goto(consentUrl.href);
      await page.getByLabel("Din e-postadress").fill(CUSTOMER.email);
      await page.screenshot({ path: join(output, "consent-before.png") });
      // Without the code the link decides nothing.
      const withoutCode = await page.request.post(salon + "/consent/" + row.id + "/decision", {
        headers: { origin: salon }, data: { decision: "yes", proposalHash: row.proposalHash }, maxRedirects: 0 });
      assert.equal(withoutCode.status(), 403);
      pass("AGENT_WITHOUT_CUSTOMER_CODE_DENIED");
      await page.getByRole("button", { name: "Skicka kod", exact: true }).click();
      await page.getByLabel("Sexsiffrig engångskod").waitFor();
      const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
      assert.equal(receipt.proposalId, row.id);
      customerCode = receipt.code;
      assert(!JSON.stringify(prepare).includes(customerCode));
      unlinkSync(receiptPath);
      await page.getByLabel("Sexsiffrig engångskod").fill(customerCode);
      await page.getByRole("button", { name: "Ja, godkänn denna bokning", exact: true }).click();
      await page.getByText("Godkänt. Agenten kan nu slutföra exakt denna bokning.", { exact: false }).waitFor();
      await page.screenshot({ path: join(output, "consent-after.png") });
    } finally { await browser.close(); }
    const approved = await db.agentProposal.findUniqueOrThrow({ where: { id: row.id }, include: { mandate: true } });
    assert.equal(approved.status, "approved"); assert.equal(approved.mandate?.origin, "customer-consent");
    assert.equal(approved.mandate?.verifiedVia, EMAIL_CODE_CHANNEL);
    assert.equal(approved.mandate?.originReference, row.id);
    assert.equal(approved.mandate?.maxPriceOre, row.priceOre);
    assert.equal(+approved.mandate!.validFrom, +row.startsAt);
    assert.equal(+approved.mandate!.validUntil, +row.startsAt + row.duration * 60000);
    const outside = { ...payload, mandateId: approved.mandateId, start: new Date(+row.startsAt + 3600000).toISOString() };
    const outOfBounds = await call("POST", "/api/v1/bookings", outside);
    assert.equal(outOfBounds.status, 403);
    assert.equal((await outOfBounds.json()).error.code, "mandate_denied");
    const changedCustomer = await call("POST", "/api/v1/bookings", { ...payload,
      mandateId: approved.mandateId, customer: { ...payload.customer, email: "other@example.test" } });
    assert.equal(changedCustomer.status, 403);
    assert.equal((await changedCustomer.json()).error.code, "mandate_denied");
    assert.equal(await db.agentBooking.count({ where: { clientId: row.clientId } }), 0);
    pass("SYNTHETIC_APPROVAL_AND_SERVER_BOUNDS");
    step = "NATIVE_AGENT_BOOKS_RETRIES_READS_STATUS";
    const retryKey = randomUUID();
    const finished = await client(gateway, key.key, cwd,
      `Continue the booking for authorized business demo. The synthetic customer has approved proposal ${row.id} in the salon consent UI. ` +
      `Read it with get_proposal. Book exactly its approved scope using its server-issued mandateId and idempotencyKey ${retryKey}. ` +
      `Use synthetic customer name ${payload.customer.name} and email ${payload.customer.email}. ` +
      "Then repeat create_booking with exactly the same payload and idempotencyKey, and read get_booking for the returned id. " +
      "Do not create a new proposal, do not select another time, and do not invent or widen authority. Report id and status.");
    const finish = finished.calls;
    assert(!JSON.stringify(finish).includes(customerCode));
    notes.push(...finished.notes); trace.push(...finish.map(safeCall));
    const creates = finish.filter(c => c.tool === "create_booking");
    assert.equal(creates.length, 2); assert(creates.every(c => !c.failed));
    assert.deepEqual(creates[0].args, creates[1].args);
    bookingId = creates[0].result.booking.id;
    assert.equal(creates[1].result.booking.id, bookingId); assert.equal(creates[1].result.replayed, true);
    assert(finish.some(c => c.tool === "get_proposal" && c.result?.proposal?.status === "approved"));
    assert(finish.some(c => c.tool === "get_booking" && c.result?.booking?.id === bookingId && c.result.booking.status === "confirmed"));
    const links = await db.agentBooking.findMany({ where: { clientId: row.clientId } });
    assert.equal(links.length, 1); assert.equal(links[0].bookingId, bookingId);
    assert.equal(links[0].mandateId, approved.mandateId);
    pass("NATIVE_BOOKING_RETRY_STATUS_ONE_ROW");
    step = "NATIVE_BOOKING_IN_SALON_CALENDAR";
    await checkSalonCalendar(salon, new URL(gateway), bookingId!, row.startsAt.toISOString(), key.key, join(output, "calendar.png"));
    pass("NATIVE_BOOKING_SAME_ID_IN_CALENDAR");
  } catch {
    console.error("FAIL " + step); throw new Error("NATIVE_PROOF_FAILED");
  } finally {
    try {
      // Revocation waits for any in-flight booking transaction before cleanup.
      if (key) await revokeAgentApiKey(key.record.id, db);
      if (key) await db.agentProposal.deleteMany({ where: { clientId: key.record.clientId } });
      await cleanupRun(run);
      assert(resolve(cwd).startsWith(tempRoot + sep)); rmSync(cwd, { recursive: true });
      cleaned = true;
    } finally {
      writeFileSync(join(output, "evidence.json"), JSON.stringify({ actor: "Codex CLI, existing ChatGPT login",
        cliVersion, node: process.version, observedAt: new Date().toISOString(), pair,
        consentActor: "automated synthetic customer with a one-time code from a private local inbox; no real identity verification", checks, trace, notes,
        bookingId, cleaned, complete: cleaned && checks.includes("NATIVE_BOOKING_SAME_ID_IN_CALENDAR"),
        failedStep: !cleaned ? "OWN_FIXTURES_CLEANUP" : checks.includes("NATIVE_BOOKING_SAME_ID_IN_CALENDAR") ? null : step }, null, 2) + "\n");
    }
  }
}
