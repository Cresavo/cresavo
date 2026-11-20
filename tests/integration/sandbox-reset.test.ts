import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it, vi, describe } from "vitest";
import { createDatabaseClient } from "../../scripts/database.mjs";
import { assertTestDatabase } from "../../scripts/test-db-guard.mjs";
import { addressProof } from "../../scripts/client-address.mjs";
import { runSandboxReset } from "@/lib/agent-api/sandbox/reset";
import { sandboxAgentRoute } from "@/lib/agent-api/sandbox/api";
import { AGENT_SCOPES } from "@/lib/agent-api/keys";
import { createSandboxSession, sandboxTransaction } from "@/lib/agent-api/sandbox/store";
import { sandboxCronHost } from "@/lib/agent-api/sandbox/config";
import { pairSandboxBrowser, readSandboxPhone, redeemSandboxPhone } from "@/lib/agent-api/sandbox/phone";
import { bookSandboxProposal, createSandboxProposal, decideSandboxProposal } from "@/lib/agent-api/sandbox/ledger";
import { DateTime } from "luxon";

const origin = "https://sandbox.example.test";
const secret = randomBytes(32).toString("hex");
const serviceToken = randomBytes(32).toString("hex");
const id = process.env.SANDBOX_TEST_INSTALLATION_ID!;
const migrationUrl = process.env.SANDBOX_TEST_MIGRATION_DATABASE_URL;
const resetUrl = process.env.SANDBOX_TEST_RESET_DATABASE_URL;
const socketSecret = randomBytes(32).toString("hex");
function phoneRequest(path: string, payload?: unknown, cookie?: string) {
  const headers = new Headers({ host: "sandbox.example.test", origin });
  if (cookie) headers.set("cookie", cookie);
  if (payload !== undefined) headers.set("content-type", "application/json");
  headers.set("x-booking-client-ip", "192.0.2.88");
  headers.set("x-booking-client-proof", addressProof("192.0.2.88", socketSecret));
  return new Request(origin + path, { method: payload === undefined ? "GET" : "POST", headers,
    body: payload === undefined ? undefined : JSON.stringify(payload) });
}
const cron = (authorization?: string) => runSandboxReset(new Request(origin + "/api/sandbox/reset", { headers: {
  host: "sandbox.example.test", ...(authorization ? { authorization } : {}),
} }));
const options = "Bearer " + secret;
const getAccess = (key: string) => sandboxAgentRoute(new Request(origin + "/api/v1/access", { headers: {
  host: "sandbox.example.test", authorization: "Bearer " + key, "x-booking-gateway-token": serviceToken,
} }), "GET /api/v1/access", AGENT_SCOPES);

describe.skipIf(!resetUrl || !migrationUrl || process.env.BOOKING_SANDBOX_TESTS !== "1")("nightly sandbox reset", () => {
  let owner: ReturnType<typeof createDatabaseClient>;
  beforeAll(async () => {
    assertTestDatabase(migrationUrl);
    assertTestDatabase(resetUrl);
    owner = createDatabaseClient(migrationUrl, 2, "sandbox");
    for (const [key, value] of Object.entries({
      BOOKING_SANDBOX: "1", BOOKING_CONSENT_DELIVERY: "sandbox-demo-phone", BOOKING_SANDBOX_ORIGIN: origin,
      BOOKING_SANDBOX_DB_ID: id, BOOKING_SERVICE_ROLE: "salon", BOOKING_RUNTIME: "local",
      BOOKING_PUBLIC_ORIGIN: "https://gateway.example.test", GATEWAY_SERVICE_TOKEN: serviceToken,
      BOOKING_ADDRESS_SECRET: socketSecret, BOOKING_SANDBOX_IP_KEY: randomBytes(32).toString("hex"),
      SESSION_SECRET: randomBytes(32).toString("hex"), CRON_SECRET: secret, BOOKING_SANDBOX_RESET_DATABASE_URL: resetUrl,
    })) vi.stubEnv(key, value);
    await owner.$executeRaw`UPDATE cresavo_sandbox.generation SET last_reset_day = NULL, reset_at = clock_timestamp()`;
  });
  afterAll(async () => { await owner?.$disconnect(); vi.unstubAllEnvs(); });

  it("checks cron host, role and secret and rolls back if deletion fails", async () => {
    const pair = await sandboxTransaction(createSandboxSession);
    expect((await cron()).status).toBe(401);
    const deployment = "https://sandbox-production-example.vercel.app";
    const app = new Request(deployment + "/api/sandbox/reset", { headers: { host: new URL(deployment).host } });
    const env = { ...process.env, BOOKING_RUNTIME: "vercel", VERCEL_URL: new URL(deployment).host, VERCEL_ENV: "production" };
    expect(sandboxCronHost(app, origin, env)).toBe(true);
    expect(sandboxCronHost(app, origin, { ...env, VERCEL_ENV: "preview" })).toBe(false);
    await expect(sandboxTransaction(tx => tx.$queryRaw`SELECT * FROM cresavo_sandbox.reset(${id}::uuid, 1)`)).rejects.toThrow();
    await expect(owner.$queryRaw`SELECT * FROM cresavo_sandbox.reset(${id}::uuid, 1)`).rejects.toThrow();
    if (process.env.SANDBOX_TEST_PRIOR_RESET_ROLE) {
      const [prior] = await owner.$queryRaw<{ allowed: boolean }[]>`
        SELECT has_function_privilege(${process.env.SANDBOX_TEST_PRIOR_RESET_ROLE}, 'cresavo_sandbox.reset(uuid,integer)', 'EXECUTE') AS allowed
      `;
      expect(prior.allowed).toBe(false);
    }
    const resetRole = createDatabaseClient(resetUrl, 1, "sandbox");
    try {
      await expect(resetRole.$queryRaw`SELECT * FROM "SandboxSession"`).rejects.toThrow();
      await expect(resetRole.$executeRaw`UPDATE cresavo_sandbox.installation SET id = ${randomUUID()}::uuid`).rejects.toThrow();
      await expect(resetRole.$queryRaw`SELECT * FROM cresavo_sandbox.reset(${randomUUID()}::uuid, 1)`).rejects.toThrow();
    } finally { await resetRole.$disconnect(); }
    await owner.$executeRawUnsafe(`CREATE FUNCTION cresavo_sandbox.test_fail_reset() RETURNS trigger
      LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'TEST_RESET_ROLLBACK'; END $$`);
    await owner.$executeRawUnsafe(`CREATE TRIGGER test_fail_reset BEFORE DELETE ON "Service"
      FOR EACH STATEMENT EXECUTE FUNCTION cresavo_sandbox.test_fail_reset()`);
    try {
      expect((await cron(options)).status).toBe(503);
      expect((await getAccess(pair.key)).status).toBe(200);
    } finally {
      await owner.$executeRawUnsafe(`DROP TRIGGER test_fail_reset ON "Service"`);
      await owner.$executeRawUnsafe(`DROP FUNCTION cresavo_sandbox.test_fail_reset()`);
    }
  });

  it("waits for in-flight mutations, revokes the old generation and keeps today's IP quota", async () => {
    const ipDigest = randomBytes(32).toString("hex");
    const previousDigest = randomBytes(32).toString("hex");
    const sentinel = randomUUID();
    await owner.service.create({ data: { id: sentinel, businessId: "demo", name: "Ordinary sentinel", duration: 30, priceOre: 0 } });
    await owner.$executeRaw`
      INSERT INTO "SandboxPairBudget" ("day","ipDigest","count")
      VALUES ((clock_timestamp() AT TIME ZONE 'UTC')::date, ${ipDigest}, 3),
        ((clock_timestamp() AT TIME ZONE 'UTC')::date - 1, ${previousDigest}, 3)
    `;
    const active = await (await pairSandboxBrowser(phoneRequest("/api/sandbox/pair", {}))).json();
    const pending = await (await pairSandboxBrowser(phoneRequest("/api/sandbox/pair", {}))).json();
    const redeem = (url: string) => redeemSandboxPhone(phoneRequest("/api/sandbox/phone/redeem", { token: new URL(url).hash.slice(1) }));
    const browser = await redeem(active.phoneUrl);
    expect(browser.status).toBe(200);
    const { phoneId } = await browser.json();
    const cookie = browser.headers.get("set-cookie")!.split(";")[0];
    let release!: () => void;
    let entered!: () => void;
    let setupFailed!: (error: unknown) => void;
    const lockHeld = new Promise<void>((resolve, reject) => { entered = resolve; setupFailed = reject; });
    const wait = new Promise<void>(resolve => { release = resolve; });
    const inFlight = sandboxTransaction(async (tx, installation) => {
      const pair = await createSandboxSession(tx, installation);
      const svc = await tx.service.findFirstOrThrow({ where: { businessId: pair.session.businessId } });
      const staff = await tx.staff.findFirstOrThrow({ where: { businessId: pair.session.businessId } });
      const key = await tx.agentApiKey.findFirstOrThrow({ where: { clientId: pair.session.clientId } });
      let day = DateTime.now().setZone("Europe/Stockholm").plus({ days: 3 }).set({ hour: 9, minute: 0, second: 0, millisecond: 0 });
      while (day.weekday > 5) day = day.plus({ days: 1 });
      const terms = { business: "demo", serviceId: svc.id, serviceVersion: svc.version, staffId: staff.id, start: day.toISO()! };
      const proposed = await createSandboxProposal(tx, pair.session, terms);
      const proposal = await tx.agentProposal.findUniqueOrThrow({ where: { id: proposed.proposal.id } });
      await decideSandboxProposal(tx, pair.session, proposal.id, proposal.proposalHash, "yes");
      const approved = await tx.agentProposal.findUniqueOrThrow({ where: { id: proposal.id } });
      await bookSandboxProposal(tx, { ...pair.session, keyId: key.id, scopes: key.scopes }, {
        ...terms, confirmed: true, mandateId: approved.mandateId,
      }, randomUUID());
      entered();
      await wait;
      await tx.sandboxAudit.create({ data: { sessionId: pair.session.id, event: "test.committed", outcome: "success" } });
      return { ...pair, proposalId: proposal.id, mandateId: approved.mandateId! };
    });
    void inFlight.catch(setupFailed);
    await lockHeld;
    const reset = cron(options);
    try {
      await vi.waitFor(async () => {
        const [probe] = await owner.$queryRaw<{ waiting: boolean }[]>`
          SELECT EXISTS (SELECT FROM pg_locks WHERE locktype = 'advisory'
            AND classid = 0 AND objid = 64119334 AND NOT granted AND mode = 'ExclusiveLock') AS waiting
        `;
        expect(probe.waiting).toBe(true);
      }, { timeout: 5000 });
    } finally { release(); }
    const pair = await inFlight;
    expect(await (await reset).json()).toEqual({ reset: true });
    expect(await (await cron(options)).json()).toEqual({ reset: false });
    expect((await getAccess(pair.key)).status).toBe(401);
    expect((await readSandboxPhone(phoneRequest("/api/sandbox/phone?phone=" + phoneId, undefined, cookie))).status).toBe(403);
    expect((await redeem(pending.phoneUrl)).status).toBe(403);
    expect(await owner.booking.count({ where: { businessId: pair.session.businessId } })).toBe(0);
    expect(await owner.agentMandate.count({ where: { id: pair.mandateId } })).toBe(0);
    expect(await owner.agentProposal.count({ where: { id: pair.proposalId } })).toBe(0);
    expect(await owner.service.count({ where: { id: sentinel } })).toBe(1);
    expect(await owner.sandboxAudit.count({ where: { sessionId: pair.session.id } })).toBe(0);
    expect(await owner.sandboxPairBudget.count({ where: { ipDigest, count: 3 } })).toBe(1);
    expect(await owner.sandboxPairBudget.count({ where: { ipDigest: previousDigest } })).toBe(0);
    const fresh = await sandboxTransaction(createSandboxSession);
    expect((await getAccess(fresh.key)).status).toBe(200);
    await owner.$executeRaw`UPDATE cresavo_sandbox.generation SET reset_at = clock_timestamp() - INTERVAL '27 hours'`;
    try { expect((await getAccess(fresh.key)).status).toBe(503); }
    finally { await owner.$executeRaw`UPDATE cresavo_sandbox.generation SET reset_at = clock_timestamp()`; }
  }, 15_000);
});
