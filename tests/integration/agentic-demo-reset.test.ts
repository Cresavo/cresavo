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
  it("removes the demo client's grant and registration and keeps an unrelated client's", async () => {
    const before = await db.agentGrant.findMany({ where: { oauthClientId: { in: [demo, other] } } });
    expect(before).toHaveLength(2);
    const counts = await db.$transaction(tx => resetDemoClients(tx, [demo]));
    expect(counts.grants).toBe(1);
    expect(await db.agentGrant.count({ where: { oauthClientId: demo } })).toBe(0);
    expect(await db.agentOAuthClient.count({ where: { id: demo } })).toBe(0);
    const kept = await db.agentGrant.findFirst({ where: { oauthClientId: other } });
    expect(kept).not.toBeNull();
    expect(await db.agentApiKey.count({ where: { id: kept!.keyId } })).toBe(1);
    expect(await db.agentClient.count({ where: { id: kept!.clientId } })).toBe(1);
    expect(await db.agentOAuthClient.count({ where: { id: other } })).toBe(1);
  });
});
