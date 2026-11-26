import { afterAll, expect, it } from "vitest";
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
