import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "../../src/lib/db";
import { grantToken, deleteGrants } from "../helpers/agent-grant";
import { origin } from "../helpers/lab-request";
import { resetDemoClients } from "../../scripts/demo-agentic/reset-lib.mjs";

// docs/demo-agentic-booking.md: the demo reset removes only the demo's own OAuth clients.
let demo: string, other: string;
beforeAll(async () => {
  vi.stubEnv("BOOKING_CONSENT_LAB", "1"); vi.stubEnv("BOOKING_RUNTIME", "local");
  vi.stubEnv("BOOKING_PUBLIC_ORIGIN", origin); vi.stubEnv("AGENT_OAUTH", "1");
  vi.stubEnv("BOOKING_ADDRESS_SECRET", "synthetic-oauth-socket-proof");
  demo = (await grantToken("demo", ["services:read", "availability:read"])).oauthClientId;
  other = (await grantToken("demo", ["services:read", "availability:read"])).oauthClientId;
});
afterAll(async () => {
  const clients = await deleteGrants([demo, other]);
  await db.agentClient.deleteMany({ where: { id: { in: clients } } });
  await db.agentOAuthCode.deleteMany({ where: { clientId: { in: [demo, other] } } });
  await db.agentOAuthClient.deleteMany({ where: { id: { in: [demo, other] } } });
  vi.unstubAllEnvs();
  await db.$disconnect();
});

describe("agentic demo reset", () => {
  it("removes the demo client's grant, keeps an unrelated client and a registration still used at another salon", async () => {
    await db.agentOAuthCode.create({ data: { hash: randomBytes(32).toString("hex"), consent: true, businessId: "lab-partner", clientId: demo,
      clientName: "Synthetic", redirectUri: "http://127.0.0.1:4555/callback", challenge: "c".repeat(43), scopes: "services:read",
      state: "", expiresAt: new Date(Date.now() + 60000) } });
    expect(await db.agentGrant.count({ where: { oauthClientId: { in: [demo, other] } } })).toBe(2);
    const counts = await db.$transaction(tx => resetDemoClients(tx, [demo]));
    expect(counts.grants).toBe(1);
    expect(await db.agentGrant.count({ where: { oauthClientId: demo } })).toBe(0);
    expect(await db.agentOAuthCode.count({ where: { clientId: demo, businessId: "lab-partner" } })).toBe(1);
    expect(await db.agentOAuthClient.count({ where: { id: demo } })).toBe(1);
    const kept = await db.agentGrant.findFirst({ where: { oauthClientId: other } });
    expect(kept).not.toBeNull();
    expect(await db.agentApiKey.count({ where: { id: kept!.keyId } })).toBe(1);
    expect(await db.agentClient.count({ where: { id: kept!.clientId } })).toBe(1);
  });
  it("never accepts a published (shared) client id", async () => {
    expect((await db.$transaction(tx => resetDemoClients(tx, ["https://claude.ai/oauth/claude-code-client-metadata"]))).grants).toBe(0);
    expect(await db.agentGrant.count({ where: { oauthClientId: other } })).toBe(1);
  });
});
