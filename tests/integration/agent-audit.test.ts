import { afterAll, afterEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "../../src/lib/db";
import { recordAudit } from "../../src/lib/agent-api/audit";
it("persists redacted audit and database rejects update and delete", async () => {
  const proposalId = randomUUID();
  await recordAudit({ event: "proposal.created", outcome: "pending", proposalId });
  const row = await db.agentAuditEvent.findFirstOrThrow({ where: { proposalId } });
  expect(row).toMatchObject({ businessId: "demo", event: "proposal.created", outcome: "pending" });
  await expect(db.agentAuditEvent.update({ where: { id: row.id }, data: { outcome: "changed" } })).rejects.toThrow();
  await expect(db.agentAuditEvent.delete({ where: { id: row.id } })).rejects.toThrow();
  expect(await db.agentAuditEvent.findUnique({ where: { id: row.id } })).toEqual(row);
});
afterAll(() => db.$disconnect());

afterEach(() => vi.unstubAllEnvs());
it("OAuth writes redacted registration, authorize and token audit to Postgres", async () => {
  const { accessToken, origin, labRequest } = await import("../helpers/oauth");
  const { oauth } = await import("../../src/lib/agent-api/oauth/server");
  vi.stubEnv("BOOKING_OAUTH_LAB", "1"); vi.stubEnv("BOOKING_RUNTIME", "local");
  vi.stubEnv("BOOKING_PUBLIC_ORIGIN", origin); vi.stubEnv("BOOKING_ADDRESS_SECRET", "synthetic-oauth-socket-proof");
  const token = await accessToken();
  const clientId = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).client_id;
  await oauth(labRequest(`${origin}/authorize?${new URLSearchParams({ client_id: clientId })}`), "authorize");
  await oauth(labRequest(`${origin}/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: clientId }) }), "token");
  const rows = await db.agentAuditEvent.findMany({ where: { clientId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
  expect(rows.map(r => r.event)).toEqual(["oauth.client_registered", "oauth.authorize_granted", "oauth.token_issued", "oauth.authorize_denied", "oauth.token_denied"]);
  for (const secret of [token, "v".repeat(43), "@example.test"]) expect(JSON.stringify(rows)).not.toContain(secret);
});
