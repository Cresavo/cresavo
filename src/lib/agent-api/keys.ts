import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { Prisma, PrismaClient } from "@prisma/client";
import { labOAuthBusiness } from "./oauth/lab-business";
import { AgentApiError } from "./errors";

// Key format: blk_<prefix>_<secret>. The prefix (12 hex) is a public lookup id
// and is shown in listings; the secret (32 random bytes) never leaves the CLI.
export const KEY_PATTERN = /^blk_([0-9a-f]{12})_([A-Za-z0-9_-]{43})$/;
export const AGENT_SCOPES = [
  "services:read",
  "availability:read",
  "bookings:read",
  "bookings:write",
] as const;
export const KEY_KINDS = ["demo-script", "registered-client", "verified-agent-proof"] as const;
export type AgentScope = (typeof AGENT_SCOPES)[number];

type KeyDb = Pick<PrismaClient, "agentApiKey"> | Prisma.TransactionClient;

export function hashApiKey(key: string) {
  return createHash("sha256").update(`booking-lab:agent-key:v1:${key}`).digest("hex");
}

export function generateApiKey() {
  const prefix = randomBytes(6).toString("hex");
  const secret = randomBytes(32).toString("base64url");
  const key = `blk_${prefix}_${secret}`;
  return { key, prefix, hash: hashApiKey(key) };
}

export const createKeySchema = z
  .object({
    businessId: z.string().trim().min(1).max(64).regex(/^[a-z0-9-]+$/),
    agentName: z.string().trim().min(2).max(80),
    ownerName: z.string().trim().min(2).max(80),
    ownerContact: z.string().trim().min(3).max(254),
    scopes: z.array(z.enum(AGENT_SCOPES)).min(1).default([...AGENT_SCOPES]),
    kind: z.enum(KEY_KINDS).default("registered-client"),
  })
  .strict();

/** Returns the plaintext key exactly once. Only its hash is persisted. */
export async function createAgentApiKey(input: unknown, client: KeyDb) {
  const { businessId, ...data } = createKeySchema.parse(input);
  const { key, prefix, hash } = generateApiKey();
  const row = await client.agentApiKey.create({
    data: {
      ...data, scopes: [...new Set(data.scopes)], keyPrefix: prefix, keyHash: hash,
      client: { create: { id: randomUUID(), businessId } },
    },
  });
  return { key, record: publicKeyRecord(row) };
}

export function publicKeyRecord(row: {
  id: string; clientId: string; businessId: string; agentName: string; ownerName: string;
  ownerContact: string; keyPrefix: string; scopes: string[]; kind: string; createdAt: Date;
  lastUsedAt: Date | null; revokedAt: Date | null;
}) {
  return {
    id: row.id,
    clientId: row.clientId,
    businessId: row.businessId,
    agentName: row.agentName,
    ownerName: row.ownerName,
    ownerContact: row.ownerContact,
    keyPrefix: `blk_${row.keyPrefix}`,
    scopes: row.scopes,
    kind: row.kind,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
  };
}

export async function listAgentApiKeys(client: KeyDb, businessId?: string) {
  const rows = await client.agentApiKey.findMany({
    where: businessId ? { businessId } : {},
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 500,
  });
  return rows.map(publicKeyRecord);
}

/** Accepts the record id or the public prefix (with or without "blk_"). */
export async function revokeAgentApiKey(idOrPrefix: string, client: KeyDb) {
  const prefix = idOrPrefix.replace(/^blk_/, "");
  const result = await client.agentApiKey.updateMany({
    where: { OR: [{ id: idOrPrefix }, { keyPrefix: prefix }], revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count;
}

export type AgentPrincipal = {
  keyId: string;
  clientId: string;
  keyPrefix: string;
  businessId: string;
  agentName: string;
  ownerName: string;
  kind: string;
  scopes: string[];
};

export function presentedKey(headers: Headers) {
  const auth = headers.get("authorization");
  const bearer = auth?.match(/^Bearer\s+(\S+)$/i)?.[1];
  const header = headers.get("x-api-key")?.trim();
  if (bearer && header && bearer !== header) return null;
  return bearer ?? header ?? null;
}

const LAST_USED_GRANULARITY_MS = 60_000;

export async function authenticateAgent(
  headers: Headers,
  client: KeyDb,
  scope: AgentScope | readonly AgentScope[],
  now = new Date(),
): Promise<AgentPrincipal> {
  const key = presentedKey(headers);
  const match = key ? KEY_PATTERN.exec(key) : null;
  if (!key) throw new AgentApiError("unauthorized");
  if (!match) {
    // OAuth is accepted only in Authorization, never as an X-API-Key.
    if (!headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)) throw new AgentApiError("unauthorized");
    const { verifyLabAccessToken } = await import("./oauth/server");
    const token = verifyLabAccessToken(key, now);
    if (!token) throw new AgentApiError("unauthorized");
    if (!(Array.isArray(scope) ? scope : [scope]).some(s => token.scopes.includes(s))) throw new AgentApiError("forbidden_scope");
    const businessId = labOAuthBusiness(token.clientId);
    const identity = createHash("sha256").update(`booking-lab:oauth-client:v1:${token.clientId}`).digest("hex");
    const clientId = `oauth_${identity}`;
    // Native write-lock checks need a credential row. Its ceiling is the
    // registered grant; the principal and transport always use token scopes.
    const row = await client.agentApiKey.upsert({
      where: { keyPrefix: clientId }, update: {},
      create: {
        keyPrefix: clientId, keyHash: createHash("sha256").update(randomBytes(32)).digest("hex"), scopes: token.registeredScopes,
        agentName: "Synthetic OAuth lab", ownerName: "Synthetic operator", ownerContact: "oauth@example.test",
        kind: "registered-client",
        client: { connectOrCreate: { where: { businessId_id: { businessId, id: clientId } },
          create: { id: clientId, businessId } } },
      }, include: { client: true },
    });
    if (row.revokedAt || !row.client.active || row.clientId !== clientId || row.businessId !== businessId)
      throw new AgentApiError("unauthorized");
    console.info(JSON.stringify({ event: "oauth_lab_auth", status: 200 }));
    return { keyId: row.id, clientId, keyPrefix: row.keyPrefix, businessId: row.businessId,
      agentName: row.agentName, ownerName: row.ownerName, kind: row.kind, scopes: token.scopes };
  }
  const row = await client.agentApiKey.findUnique({ where: { keyPrefix: match[1] }, include: { client: true } });
  const expected = Buffer.from(row?.keyHash ?? "0".repeat(64), "hex");
  const actual = Buffer.from(hashApiKey(key), "hex");
  // Compare even for unknown prefixes so timing does not reveal valid prefixes.
  const equal = timingSafeEqual(expected, actual);
  if (!row || !equal || row.revokedAt || !row.client.active || row.client.businessId !== row.businessId)
    throw new AgentApiError("unauthorized");
  if (!(Array.isArray(scope) ? scope : [scope]).some(s => row.scopes.includes(s))) throw new AgentApiError("forbidden_scope");
  if (!row.lastUsedAt || now.getTime() - row.lastUsedAt.getTime() > LAST_USED_GRANULARITY_MS)
    await client.agentApiKey.updateMany({
      where: { id: row.id, revokedAt: null },
      data: { lastUsedAt: now },
    });
  return {
    keyId: row.id,
    clientId: row.clientId,
    keyPrefix: row.keyPrefix,
    businessId: row.businessId,
    agentName: row.agentName,
    ownerName: row.ownerName,
    kind: row.kind,
    scopes: row.scopes,
  };
}

/** Trusted operator operation. The new credential owns the SAME stable client. */
export async function rotateAgentApiKey(keyId: string, client: PrismaClient) {
  return client.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "AgentApiKey" WHERE "id"=${keyId} AND "revokedAt" IS NULL FOR UPDATE`;
    if (!rows.length) throw new AgentApiError("unauthorized");
    const old = await tx.agentApiKey.findUniqueOrThrow({ where: { id: keyId }, include: { client: true } });
    if (!old.client.active) throw new AgentApiError("unauthorized");
    const next = generateApiKey();
    const row = await tx.agentApiKey.create({ data: {
      agentName: old.agentName, ownerName: old.ownerName, ownerContact: old.ownerContact,
      kind: old.kind, scopes: old.scopes, keyHash: next.hash, keyPrefix: next.prefix,
      client: { connect: { businessId_id: { businessId: old.businessId, id: old.clientId } } },
    } });
    await tx.agentApiKey.update({ where: { id: old.id }, data: { revokedAt: new Date() } });
    return { key: next.key, record: publicKeyRecord(row) };
  });
}

/** Object-level authorisation: a key may only read its own business. */
export function assertBusinessAccess(principal: AgentPrincipal, businessId: string) {
  if (principal.businessId !== businessId) throw new AgentApiError("forbidden_business");
}
