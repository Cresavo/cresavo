import { randomBytes, randomInt } from "node:crypto";
import { DateTime } from "luxon";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { addressProof } from "../../scripts/client-address.mjs";
import { createDatabaseClient } from "../../scripts/database.mjs";
import { sandboxPage } from "@/lib/agent-api/sandbox/browser-page";
import { decideSandboxPhone, pairSandboxBrowser, readSandboxPhone, redeemSandboxPhone } from "@/lib/agent-api/sandbox/phone";
import { createSandboxProposal } from "@/lib/agent-api/sandbox/ledger";
import { MAX_SANDBOX_SESSIONS } from "@/lib/agent-api/sandbox/config";
import { authenticateSandboxAgent, sandboxSessionUsage, sandboxTransaction } from "@/lib/agent-api/sandbox/store";

const origin = "https://sandbox.example.test";
const transportSecret = randomBytes(32).toString("hex");
// No leading zero: the server signs the normalized address, so "0d1f" would fail as "d1f".
const testIp = "2001:db8:" + randomInt(0x1000, 0x10000).toString(16) + "::";
function request(path: string, body?: unknown, headers: Record<string, string> = {}, address = testIp + "1") {
  return new Request(origin + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      host: "sandbox.example.test", origin,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      "x-booking-client-ip": address, "x-booking-client-proof": addressProof(address, transportSecret),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe.skipIf(process.env.BOOKING_SANDBOX_TESTS !== "1")("private sandbox demo phone", () => {
  beforeAll(() => {
    for (const [key, value] of Object.entries({
      BOOKING_SANDBOX: "1", BOOKING_CONSENT_DELIVERY: "sandbox-demo-phone", BOOKING_SANDBOX_ORIGIN: origin,
      BOOKING_SANDBOX_DB_ID: process.env.SANDBOX_TEST_INSTALLATION_ID, BOOKING_SERVICE_ROLE: "salon",
      BOOKING_RUNTIME: "local", BOOKING_ADDRESS_SECRET: transportSecret, BOOKING_PUBLIC_ORIGIN: "https://gateway.example.test",
      BOOKING_SANDBOX_IP_KEY: randomBytes(32).toString("hex"), GATEWAY_SERVICE_TOKEN: randomBytes(32).toString("hex"),
      SESSION_SECRET: randomBytes(32).toString("hex"),
    })) vi.stubEnv(key, value);
  });
  afterAll(() => vi.unstubAllEnvs());

  it("enforces the same-origin and atomic IPv6 /64 pair limits", async () => {
    const pair = "/api/sandbox/pair";
    expect((await pairSandboxBrowser(request(pair, {}, { origin: "https://other.example.test" }))).status).toBe(403);
    expect((await pairSandboxBrowser(request(pair, {}, { "x-booking-client-proof": "0".repeat(64) }))).status).toBe(403);
    expect((await pairSandboxBrowser(request(pair, {}, { authorization: "Bearer unused" }))).status).toBe(403);
    const insecure = request(pair, {});
    expect((await pairSandboxBrowser(new Request(insecure.url.replace("https:", "http:"), {
      method: "POST", headers: insecure.headers, body: "{}",
    }))).status).toBe(404);
    const results = await Promise.all([1, 2, 3, 4].map(i => pairSandboxBrowser(request(pair, {}, {}, testIp + i))));
    expect(results.map(row => row.status).sort()).toEqual([201, 201, 201, 429]);
    expect(Number(results.find(row => row.status === 429)?.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(results.find(row => row.status === 201)?.headers.get("Cache-Control")).toContain("no-store");
    const entryPage = sandboxPage(request("/sandbox", undefined, { "sec-fetch-site": "same-site" }), false);
    expect(entryPage.status).toBe(200);
    expect(entryPage.headers.get("Content-Security-Policy")).toMatch(/script-src 'nonce-/);
  });

  it("redeems only once, reads only its inbox and rejects foreign, replayed or CSRF decisions", async () => {
    const pairs = await Promise.all([1, 2].map(async i => {
      const response = await pairSandboxBrowser(request("/api/sandbox/pair", {}, {}, `192.0.2.${i}`));
      expect(response.status).toBe(201);
      const pair = await response.json();
      const session = await sandboxTransaction(async tx => {
        const key = await tx.agentApiKey.findUniqueOrThrow({ where: { keyPrefix: pair.agentKey.split("_")[1] } });
        expect(key.keyHash === pair.agentKey).toBe(false);
        return tx.sandboxSession.findUniqueOrThrow({ where: { clientId: key.clientId } });
      });
      const proposal = await sandboxTransaction(async tx => {
        const service = await tx.service.findFirstOrThrow({ where: { businessId: session.businessId } });
        const staff = await tx.staff.findFirstOrThrow({ where: { businessId: session.businessId } });
        return createSandboxProposal(tx, session, {
          business: "demo", serviceId: service.id, serviceVersion: service.version, staffId: staff.id,
          start: DateTime.now().plus({ days: 2 }).toISO()!,
        });
      });
      return { ...pair, session, proposalId: proposal.proposal.id };
    }));
    const redeem = (pair: typeof pairs[number]) =>
      redeemSandboxPhone(request("/api/sandbox/phone/redeem", { token: new URL(pair.phoneUrl).hash.slice(1) }));
    const double = await Promise.all([redeem(pairs[0]), redeem(pairs[0])]);
    expect(double.map(row => row.status).sort()).toEqual([200, 403]);
    const firstResponse = double.find(row => row.status === 200)!;
    const secondResponse = await redeem(pairs[1]);
    const firstCookie = firstResponse.headers.get("Set-Cookie")!;
    const secondCookie = secondResponse.headers.get("Set-Cookie")!;
    const [firstPhone, secondPhone] = await Promise.all([firstResponse.json(), secondResponse.json()]);
    expect(firstCookie).toMatch(/Secure; HttpOnly; SameSite=Strict/);
    const bothCookies = [firstCookie, secondCookie].map(cookie => cookie.split(";")[0]).join("; ");
    const [a, b] = await Promise.all([firstPhone, secondPhone].map(({ phoneId }) =>
      readSandboxPhone(request("/api/sandbox/phone?phone=" + phoneId, undefined, { cookie: bothCookies })).then(res => res.json()),
    ));
    expect((await readSandboxPhone(request("/api/sandbox/phone", undefined, { cookie: bothCookies }))).status).toBe(403);
    expect((await readSandboxPhone(request("/api/sandbox/phone?phone=" + secondPhone.phoneId, undefined,
      { cookie: firstCookie.split(";")[0] }))).status).toBe(403);
    expect(a.proposals.map((p: { id: string }) => p.id)).toEqual([pairs[0].proposalId]);
    expect(b.proposals.map((p: { id: string }) => p.id)).toEqual([pairs[1].proposalId]);
    const decide = (proposal: { id: string; proposalHash: string }, nonce: string) =>
      decideSandboxPhone(request("/api/sandbox/phone/decision?phone=" + firstPhone.phoneId, {
        id: proposal.id, hash: proposal.proposalHash, decision: "yes",
      }, { cookie: firstCookie.split(";")[0], "x-sandbox-csrf": nonce }));
    expect((await decide(a.proposals[0], b.csrf)).status).toBe(403);
    expect((await decide(b.proposals[0], a.csrf)).status).toBe(403);
    expect(await (await decide(a.proposals[0], a.csrf)).json()).toEqual({ status: "approved" });
    expect((await decide(a.proposals[0], a.csrf)).status).toBe(403);
  });

  it("denies an expired unredeemed link", async () => {
    const response = await pairSandboxBrowser(request("/api/sandbox/pair", {}, {}, "192.0.2.33"));
    expect(response.status).toBe(201);
    const pair = await response.json();
    const ownerUrl = process.env.SANDBOX_TEST_MIGRATION_DATABASE_URL;
    if (!ownerUrl) throw Error("LOCAL_TEST_MIGRATION_ROLE_REQUIRED");
    const admin = createDatabaseClient(ownerUrl, 1, "sandbox");
    try {
      await admin.$executeRaw`
        UPDATE "SandboxSession" SET "expiresAt" = CURRENT_TIMESTAMP - INTERVAL '1 minute'
        WHERE "clientId" = (SELECT "clientId" FROM "AgentApiKey" WHERE "keyPrefix" = ${pair.agentKey.split("_")[1]})
      `;
      const redeem = await redeemSandboxPhone(request("/api/sandbox/phone/redeem", { token: new URL(pair.phoneUrl).hash.slice(1) }));
      expect(redeem.status).toBe(403);
      expect(redeem.headers.has("Set-Cookie")).toBe(false);
    } finally { await admin.$disconnect(); }
  });

  it("keeps one live session per pairing bucket, shares the budget across an IPv6 /48 and frees the slot on re-pairing", async () => {
    const pair = (address: string) => pairSandboxBrowser(request("/api/sandbox/pair", {}, {}, address));
    const authenticates = (agentKey: string) => sandboxTransaction((tx, installation) => authenticateSandboxAgent(
      tx, installation, new Headers({ authorization: "Bearer " + agentKey }), "services:read")).then(() => true, () => false);
    const usage = () => sandboxTransaction(sandboxSessionUsage);
    // A /48 that differs from the first test's prefix, so their budgets stay separate.
    const net = "2001:db8:" + ((parseInt(testIp.split(":")[2], 16) + 1) % 0x10000).toString(16);
    const prefixes: string[] = [];
    const paired = async (address: string) => {
      const response = await pair(address);
      expect(response.status).toBe(201);
      const body = await response.json() as { agentKey: string; phoneUrl: string };
      prefixes.push(body.agentKey.split("_")[1]);
      return body;
    };
    const ownerUrl = process.env.SANDBOX_TEST_MIGRATION_DATABASE_URL;
    if (!ownerUrl) throw Error("LOCAL_TEST_MIGRATION_ROLE_REQUIRED");
    try {
      const first = await paired(net + ":1::7");
      expect(await authenticates(first.agentKey)).toBe(true);
      const sessionOf = (agentKey: string) => sandboxTransaction(async tx => {
        const key = await tx.agentApiKey.findUniqueOrThrow({ where: { keyPrefix: agentKey.split("_")[1] } });
        return tx.sandboxSession.findUniqueOrThrow({ where: { clientId: key.clientId }, include: { phone: true } });
      });
      const owner = createDatabaseClient(ownerUrl, 1, "sandbox");
      try {
        const { id } = await sessionOf(first.agentKey);
        await owner.$executeRaw`UPDATE "SandboxSession" SET "apiRequests" = 200 WHERE "id" = ${id}::uuid`;
        await owner.$executeRaw`UPDATE "SandboxPhone" SET "requests" = 90 WHERE "sessionId" = ${id}::uuid`;
      } finally { await owner.$disconnect(); }
      const before = await usage();
      const second = await paired(net + ":2::7");
      // Pairing again never refills the used call budgets.
      const replacement = await sessionOf(second.agentKey);
      expect(replacement.apiRequests).toBe(200);
      expect(replacement.phone?.requests).toBe(90);
      expect(await authenticates(first.agentKey)).toBe(false);
      expect(await authenticates(second.agentKey)).toBe(true);
      const after = await usage();
      expect(after.held).toBe(before.held);
      expect(after.created).toBe(before.created + 1);
      const oldLink = await redeemSandboxPhone(request("/api/sandbox/phone/redeem", { token: new URL(first.phoneUrl).hash.slice(1) }));
      expect(oldLink.status).toBe(403);
      await paired(net + ":3::7");
      expect((await pair(net + ":4::7")).status).toBe(429);

      // Fill the remaining capacity from separate buckets.
      for (let i = 1; (await usage()).held < MAX_SANDBOX_SESSIONS; i++) await paired("198.51.100." + i);
      expect((await pair("198.51.100.250")).status).toBe(429);
      // A bucket that already holds a slot can pair again; it replaces its own session.
      await paired("198.51.100.1");
      expect((await usage()).held).toBe(MAX_SANDBOX_SESSIONS);
    } finally {
      // Release the capacity for the tests that follow: revoked sessions hold no slot.
      const admin = createDatabaseClient(ownerUrl, 1, "sandbox");
      try {
        await admin.$executeRaw`
          UPDATE "AgentApiKey" SET "revokedAt" = CURRENT_TIMESTAMP WHERE "keyPrefix" = ANY(${prefixes}) AND "revokedAt" IS NULL
        `;
      } finally { await admin.$disconnect(); }
    }
  });

  it("lets an expired session's bucket pair again without holding a second slot", async () => {
    const address = "192.0.2.91";
    const first = await (await pairSandboxBrowser(request("/api/sandbox/pair", {}, {}, address))).json();
    const ownerUrl = process.env.SANDBOX_TEST_MIGRATION_DATABASE_URL;
    if (!ownerUrl) throw Error("LOCAL_TEST_MIGRATION_ROLE_REQUIRED");
    const admin = createDatabaseClient(ownerUrl, 1, "sandbox");
    try {
      await admin.$executeRaw`
        UPDATE "SandboxSession" SET "expiresAt" = CURRENT_TIMESTAMP - INTERVAL '1 minute'
        WHERE "clientId" = (SELECT "clientId" FROM "AgentApiKey" WHERE "keyPrefix" = ${first.agentKey.split("_")[1]})
      `;
    } finally { await admin.$disconnect(); }
    const before = await sandboxTransaction(sandboxSessionUsage);
    expect((await pairSandboxBrowser(request("/api/sandbox/pair", {}, {}, address))).status).toBe(201);
    expect((await sandboxTransaction(sandboxSessionUsage)).held).toBe(before.held);
  });

  it("revokes the replaced session's phone cookie", async () => {
    const address = "192.0.2.77";
    const first = await (await pairSandboxBrowser(request("/api/sandbox/pair", {}, {}, address))).json();
    const redeemed = await redeemSandboxPhone(request("/api/sandbox/phone/redeem", { token: new URL(first.phoneUrl).hash.slice(1) }));
    expect(redeemed.status).toBe(200);
    const cookie = redeemed.headers.get("Set-Cookie")!.split(";")[0];
    const { phoneId } = await redeemed.json();
    const read = () => readSandboxPhone(request("/api/sandbox/phone?phone=" + phoneId, undefined, { cookie }));
    expect((await read()).status).toBe(200);
    expect((await pairSandboxBrowser(request("/api/sandbox/pair", {}, {}, address))).status).toBe(201);
    expect((await read()).status).toBe(403);
  });
});
