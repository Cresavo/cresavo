import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { Prisma, PrismaClient } from "@prisma/client";
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
  const data = createKeySchema.parse(input);
  const { key, prefix, hash } = generateApiKey();
  const row = await client.agentApiKey.create({
    data: { ...data, scopes: [...new Set(data.scopes)], keyPrefix: prefix, keyHash: hash },
  });
  return { key, record: publicKeyRecord(row) };
}

export function publicKeyRecord(row: {
  id: string; businessId: string; agentName: string; ownerName: string;
  ownerContact: string; keyPrefix: string; scopes: string[]; kind: string; createdAt: Date;
  lastUsedAt: Date | null; revokedAt: Date | null;
}) {
  return {
    id: row.id,
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
  scope: AgentScope,
  now = new Date(),
): Promise<AgentPrincipal> {
  const key = presentedKey(headers);
  const match = key ? KEY_PATTERN.exec(key) : null;
  if (!key || !match) throw new AgentApiError("unauthorized");
  const row = await client.agentApiKey.findUnique({ where: { keyPrefix: match[1] } });
  const expected = Buffer.from(row?.keyHash ?? "0".repeat(64), "hex");
  const actual = Buffer.from(hashApiKey(key), "hex");
  // Compare even for unknown prefixes so timing does not reveal valid prefixes.
  const equal = timingSafeEqual(expected, actual);
  if (!row || !equal || row.revokedAt) throw new AgentApiError("unauthorized");
  if (!row.scopes.includes(scope)) throw new AgentApiError("forbidden_scope");
  if (!row.lastUsedAt || now.getTime() - row.lastUsedAt.getTime() > LAST_USED_GRANULARITY_MS)
    await client.agentApiKey.updateMany({
      where: { id: row.id, revokedAt: null },
      data: { lastUsedAt: now },
    });
  return {
    keyId: row.id,
    keyPrefix: row.keyPrefix,
    businessId: row.businessId,
    agentName: row.agentName,
    ownerName: row.ownerName,
    kind: row.kind,
    scopes: row.scopes,
  };
}

/** Object-level authorisation: a key may only read its own business. */
export function assertBusinessAccess(principal: AgentPrincipal, businessId: string) {
  if (principal.businessId !== businessId) throw new AgentApiError("forbidden_business");
}
