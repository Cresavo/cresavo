import { recordAudit } from "./audit";
import { assertWritable } from "../public-readonly";
import type { Prisma, PrismaClient, AgentMandate } from "@prisma/client";
import { AgentApiError } from "./errors";
import type { AgentPrincipal } from "./keys";
import { mandateSchema } from "./mandate-policy";

/** Operator database capability required; never exposed as a REST/MCP tool. */
export async function issueSyntheticMandate(input: unknown, client: PrismaClient) {
  assertWritable();
  const data = mandateSchema.parse(input);
  if (Date.parse(data.expiresAt) <= Date.now()) throw new AgentApiError("mandate_denied");
  const owner = await client.agentClient.findFirst({
    where: { id: data.clientId, businessId: data.businessId, active: true },
  });
  if (!owner) throw new AgentApiError("mandate_denied");
  const mandate = await client.agentMandate.create({ data: {
    ...data, validFrom: new Date(data.validFrom), validUntil: new Date(data.validUntil),
    expiresAt: new Date(data.expiresAt),
  } });
  await recordAudit({ businessId: data.businessId, event: "mandate.created", outcome: "synthetic-operator", mandateId: mandate.id, clientId: mandate.clientId });
  return mandate;
}

/** Revocation and rotation linearise against these row locks at commit. */
export async function assertCurrentAgent(tx: Prisma.TransactionClient, p: AgentPrincipal) {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT k."id" FROM "AgentApiKey" k JOIN "AgentClient" c
      ON c."id"=k."clientId" AND c."businessId"=k."businessId"
    WHERE k."id"=${p.keyId} AND k."clientId"=${p.clientId}
      AND k."businessId"=${p.businessId} AND k."revokedAt" IS NULL
      AND c."active"=true AND 'bookings:write'=ANY(k."scopes")
    FOR SHARE OF k,c`;
  if (!rows.length) throw new AgentApiError("unauthorized");
}

export async function lockMandate(tx: Prisma.TransactionClient, id: string) {
  const rows = await tx.$queryRaw<AgentMandate[]>`SELECT * FROM "AgentMandate" WHERE "id"=${id} FOR UPDATE`;
  return rows[0] ?? null;
}
