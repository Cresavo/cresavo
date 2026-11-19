import type { PairWorkspace } from "@prisma/client";
import { jsonValue, type Tx } from "./db";
import type { PairState } from "./fixture";
import { budget, digest, hour, ipKey, ownerHash, requirePair, secret } from "./http";

export { freshSnapshot, snapshot } from "./fixture";

export async function start(tx: Tx, request: Request, day: string, prepared: ReturnType<typeof jsonValue>) {
  const ip = ipKey(request);
  await budget(tx, "start:" + ip, 12, hour);
  // Serialize both counts and creation. The lock lasts until commit.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(518291710)`;
  const live = { expiresAt: { gt: new Date() }, hardExpiry: { gt: new Date() } };
  requirePair(await tx.pairWorkspace.count({ where: { ...live, ipKey: ip } }) < 6 &&
    await tx.pairWorkspace.count({ where: live }) < 2000, "workspace_limit", 429);
  const token = secret();
  await tx.pairWorkspace.create({ data: { ownerHash: digest(token), ipKey: ip, seedDay: day,
    version: 2, snapshot: prepared, expiresAt: new Date(Date.now() + hour), hardExpiry: new Date(Date.now() + 24 * hour) }, select: { id: true } });
  return token;
}

export async function lockWorkspace(tx: Tx, id: string, renew = true) {
  const [row] = await tx.$queryRaw<{ id: string; expiresAt: Date; hardExpiry: Date; revision: number }[]>`
    SELECT id, "expiresAt", "hardExpiry", revision FROM "PairWorkspace" WHERE id = ${id} FOR UPDATE`;
  const now = Date.now();
  requirePair(row && row.expiresAt.getTime() > now && row.hardExpiry.getTime() > now, "session_expired", 401);
  if (renew) await renewWorkspace(tx, row);
  return row;
}

export async function renewWorkspace(tx: Tx, row: Pick<PairWorkspace, "id" | "hardExpiry" | "expiresAt">) {
  // Coalesce rolling writes. Hard expiry remains independent of activity.
  const next = Math.min(Date.now() + hour, row.hardExpiry.getTime());
  if (next - row.expiresAt.getTime() > 30_000) {
    row.expiresAt = new Date(next);
    await tx.pairWorkspace.update({ where: { id: row.id }, data: { expiresAt: row.expiresAt }, select: { id: true } });
  }
}
export async function owner(tx: Tx, request: Request, renew = true) {
  const hash = ownerHash(request);
  requirePair(hash, "start_pairing", 401);
  if (renew) {
    const workspace = await tx.pairWorkspace.findUnique({ where: { ownerHash: hash }, select: { id: true } });
    requirePair(workspace, "start_pairing", 401);
    return lockWorkspace(tx, workspace.id);
  }
  const [workspace] = await tx.$queryRaw<Pick<PairWorkspace, "id" | "expiresAt" | "hardExpiry" | "revision">[]>`
    SELECT id, "expiresAt", "hardExpiry", revision FROM "PairWorkspace" WHERE "ownerHash" = ${hash} FOR SHARE`;
  const now = new Date();
  requirePair(workspace && workspace.expiresAt > now && workspace.hardExpiry > now, "session_expired", 401);
  return workspace;
}

export async function bump(tx: Tx, id: string, state?: PairState) {
  await tx.pairWorkspace.update({ where: { id }, data: {
    revision: { increment: 1 }, ...(state ? { version: 2, snapshot: jsonValue(state) } : {}),
  }, select: { id: true } });
}
