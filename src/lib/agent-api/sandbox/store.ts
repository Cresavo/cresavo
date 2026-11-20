import type { Prisma, PrismaClient, SandboxSession } from "@prisma/client";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { createDatabaseClient } from "../../../../scripts/database.mjs";
import { AgentApiError } from "../errors";
import { AGENT_SCOPES, generateApiKey, hashApiKey, KEY_PATTERN, presentedKey, type AgentScope } from "../keys";
import { DAY_MS, MAX_SANDBOX_REQUESTS_PER_SESSION, MAX_SANDBOX_SESSIONS, sandboxConfig } from "./config";
import { seedSandboxSalon } from "./seed";

export const SANDBOX_KEY_KIND = "sandbox-demo";
type Installation = { id: string; generation: number; revision: number; resetAt: Date };
export type SandboxAgent = SandboxSession & { keyId: string; scopes: string[] };
let client: PrismaClient | undefined;

export async function sandboxTransaction<T>(
  run: (tx: Prisma.TransactionClient, installation: Installation) => Promise<T>,
) {
  const config = sandboxConfig();
  client ??= createDatabaseClient(undefined, 2, "sandbox");
  return client.$transaction(async tx => {
    // The runtime can share the transaction lock without UPDATE access to the installation or generation.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(64119334)`;
    const [row] = await tx.$queryRaw<Installation[]> `
      SELECT i.id::text, g.generation, i.revision, g.reset_at AS "resetAt"
      FROM cresavo_sandbox.installation i CROSS JOIN cresavo_sandbox.generation g
      WHERE i.singleton AND g.singleton AND i.id = ${config.installation}::uuid AND i.revision = ${config.revision}
        AND g.reset_at > clock_timestamp() - INTERVAL '26 hours'
    `;
    if (!row) throw new AgentApiError("provider_configuration_invalid");
    return run(tx, row);
  }, { maxWait: 3000, timeout: 8000 });
}

export async function sandboxNow(tx: Prisma.TransactionClient) {
  const [row] = await tx.$queryRaw<{ now: Date }[]>`SELECT clock_timestamp() AS now`;
  return row.now;
}

export async function authenticateSandboxAgent(
  tx: Prisma.TransactionClient,
  installation: Installation,
  headers: Headers,
  required: AgentScope | readonly AgentScope[],
): Promise<SandboxAgent> {
  const key = presentedKey(headers);
  const match = key && KEY_PATTERN.exec(key);
  if (!match) throw new AgentApiError("unauthorized");
  const [row] = await tx.$queryRaw<(SandboxAgent & { keyHash: string })[]>`
    SELECT s.*, k."id" AS "keyId", k."scopes", k."keyHash"
    FROM "SandboxSession" s
    JOIN "AgentClient" c ON c."id" = s."clientId" AND c."businessId" = s."businessId"
    JOIN "AgentApiKey" k ON k."clientId" = c."id" AND k."businessId" = c."businessId"
    WHERE k."keyPrefix" = ${match[1]} AND k."kind" = ${SANDBOX_KEY_KIND}
      AND k."revokedAt" IS NULL AND c."active" AND s."generation" = ${installation.generation}
    FOR UPDATE OF s FOR SHARE OF c,k
  `;
  const equal = timingSafeEqual(Buffer.from(row?.keyHash ?? "0".repeat(64), "hex"), Buffer.from(hashApiKey(key), "hex"));
  if (!row || !equal || row.expiresAt <= await sandboxNow(tx)) throw new AgentApiError("unauthorized");
  if (!(typeof required === "string" ? [required] : required).some(scope => row.scopes.includes(scope)))
    throw new AgentApiError("forbidden_scope");
  const { keyHash: _hash, ...agent } = row;
  void _hash;
  return agent;
}

export async function chargeSandboxAgent(tx: Prisma.TransactionClient, agent: SandboxAgent) {
  const now = await sandboxNow(tx);
  if (agent.apiRequests >= MAX_SANDBOX_REQUESTS_PER_SESSION)
    throw new AgentApiError("rate_limited", Math.max(1, Math.ceil((+agent.expiresAt - +now) / 1000)));
  await tx.sandboxSession.update({ where: { id: agent.id }, data: { apiRequests: { increment: 1 } } });
}

// Created sessions per generation may exceed live ones only through replacements, at most this factor.
const RETAINED_SESSION_FACTOR = 3;

/**
 * A session holds a slot until it is replaced or the generation resets, even after it expires, so call
 * budgets never come back within a generation. Created sessions bound retained state.
 */
export async function sandboxSessionUsage(tx: Prisma.TransactionClient, installation: Installation) {
  const [usage] = await tx.$queryRaw<{ held: number; created: number }[]>`
    SELECT (count(*) FILTER (WHERE k."revokedAt" IS NULL AND c."active"))::int AS held,
      count(*)::int AS created
    FROM "SandboxSession" s
    JOIN "AgentClient" c ON c."id" = s."clientId" AND c."businessId" = s."businessId"
    JOIN "AgentApiKey" k ON k."clientId" = c."id" AND k."businessId" = c."businessId" AND k."kind" = ${SANDBOX_KEY_KIND}
    WHERE s."generation" = ${installation.generation}
  `;
  return usage;
}

/**
 * Ends the bucket's sessions so one pairing bucket never holds more than one of the shared slots.
 * Returns their used call budgets: a replacement carries them, so pairing again never refills a budget.
 */
async function replacePairedSessions(tx: Prisma.TransactionClient, installation: Installation, pairDigest: string, now: Date) {
  const live = await tx.$queryRaw<(Pick<SandboxSession, "id" | "businessId" | "clientId" | "apiRequests"> & { phoneRequests: number | null })[]>`
    SELECT s."id", s."businessId", s."clientId", s."apiRequests", p."requests" AS "phoneRequests" FROM "SandboxSession" s
    JOIN "AgentClient" c ON c."id" = s."clientId" AND c."businessId" = s."businessId"
    LEFT JOIN "SandboxPhone" p ON p."sessionId" = s."id"
    WHERE s."generation" = ${installation.generation} AND s."pairDigest" = ${pairDigest} AND c."active"
    FOR UPDATE OF s, c
  `;
  const carried = { apiRequests: 0, phoneRequests: 0 };
  for (const { id, businessId, clientId, apiRequests, phoneRequests } of live) {
    await tx.agentApiKey.updateMany({ where: { businessId, clientId, revokedAt: null }, data: { revokedAt: now } });
    await tx.agentMandate.updateMany({ where: { businessId, clientId, revokedAt: null }, data: { revokedAt: now } });
    await tx.agentClient.updateMany({ where: { businessId, id: clientId }, data: { active: false } });
    await tx.sandboxAudit.create({ data: { sessionId: id, event: "pair.replaced", outcome: "revoked" } });
    carried.apiRequests = Math.max(carried.apiRequests, apiRequests);
    carried.phoneRequests = Math.max(carried.phoneRequests, phoneRequests ?? 0);
  }
  return carried;
}

/**
 * Caller has already locked and verified the installation. No public issuance route in this layer.
 * With a pairing digest, an earlier live session from the same bucket is revoked first and its used
 * call budgets carry over; the revocation is rolled back with the transaction if no slot is free.
 */
export async function createSandboxSession(tx: Prisma.TransactionClient, installation: Installation, pairDigest?: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(64119333)`;
  const now = await sandboxNow(tx);
  const carried = pairDigest === undefined
    ? { apiRequests: 0, phoneRequests: 0 }
    : await replacePairedSessions(tx, installation, pairDigest, now);
  const { held, created } = await sandboxSessionUsage(tx, installation);
  if (held >= MAX_SANDBOX_SESSIONS || created >= MAX_SANDBOX_SESSIONS * RETAINED_SESSION_FACTOR)
    throw new AgentApiError("rate_limited", 3600);
  const id = randomUUID();
  const businessId = "sandbox-" + id;
  const clientId = randomUUID();
  const { key, prefix, hash } = generateApiKey();
  await tx.agentClient.create({ data: { id: clientId, businessId } });
  await tx.agentApiKey.create({ data: {
    businessId, clientId, keyPrefix: prefix, keyHash: hash, kind: SANDBOX_KEY_KIND,
    agentName: "Sandbox assistant", ownerName: "Salong Eko", ownerContact: "sandbox-owner@example.test",
    scopes: [...AGENT_SCOPES],
  } });
  const session = await tx.sandboxSession.create({ data: {
    id, businessId, clientId, generation: installation.generation, expiresAt: new Date(+now + DAY_MS), pairDigest,
    apiRequests: carried.apiRequests,
  } });
  await seedSandboxSalon(tx, businessId);
  return { session, key, carriedPhoneRequests: carried.phoneRequests };
}

export async function sandboxJson(request: Request) {
  if (!request.body || request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json")
    throw new AgentApiError("invalid_request");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 65536) {
        await reader.cancel();
        throw new AgentApiError("invalid_request");
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new AgentApiError("invalid_request");
  } finally {
    reader.releaseLock();
  }
}
