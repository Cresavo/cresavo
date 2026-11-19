import type { PairWorkspace } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { createDemoState } from "../data/generate";
import { weekday } from "../data/dates";
import type { DemoState } from "../data/types";
import { salonClock } from "../tools/clock";
import { t } from "../i18n";
import { jsonValue, type Tx } from "./db";
import { budget, digest, hour, ipKey, ownerHash, requirePair, secret } from "./http";

export function freshSnapshot(today: string) {
  const state = createDemoState(today);
  const ids = new Map([...state.bookings, ...state.inbox].map(row => [row.id, randomUUID()]));
  const fresh: DemoState = JSON.parse(JSON.stringify(state, (_, value) => ids.get(value) ?? value));
  const booking = fresh.bookings.find(b => b.date > today && weekday(b.date) === 5 && b.status === "booked");
  requirePair(booking, "fixture_unavailable", 503);
  fresh.inbox.unshift({
    id: randomUUID(), kind: "reschedule", date: today, time: 540, bookingId: booking.id,
    customerId: booking.customerId, title: t("pair.request"), body: t("pair.request"), read: false, handled: false,
  }, {
    id: randomUUID(), kind: "message", date: today, time: 530, title: t("pair.sampleTitle"),
    body: t("pair.sampleBody"), read: false, handled: false,
  });
  return fresh;
}
export function snapshot(w: PairWorkspace) {
  requirePair(w.version === 1, "unsupported_snapshot", 409);
  return w.snapshot as unknown as DemoState;
}

export async function start(tx: Tx, request: Request) {
  const ip = ipKey(request);
  await budget(tx, "start:" + ip, 12, hour);
  // Serialize both counts and creation. The lock lasts until commit.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(518291710)`;
  requirePair(await tx.pairWorkspace.count({ where: { ipKey: ip } }) < 6 && await tx.pairWorkspace.count() < 250, "workspace_limit", 429);
  const token = secret();
  const day = salonClock().today;
  await tx.pairWorkspace.create({ data: { ownerHash: digest(token), ipKey: ip, seedDay: day,
    snapshot: jsonValue(freshSnapshot(day)), expiresAt: new Date(Date.now() + hour), hardExpiry: new Date(Date.now() + 24 * hour) }, select: { id: true } });
  return token;
}

export async function lockWorkspace(tx: Tx, id: string) {
  const [row] = await tx.$queryRaw<{ id: string; expiresAt: Date; hardExpiry: Date; revision: number }[]>`
    SELECT id, "expiresAt", "hardExpiry", revision FROM "PairWorkspace" WHERE id = ${id} FOR UPDATE`;
  const now = Date.now();
  requirePair(row && row.expiresAt.getTime() > now && row.hardExpiry.getTime() > now, "session_expired", 401);
  // Coalesce rolling writes. Hard expiry remains independent of activity.
  const next = Math.min(now + hour, row.hardExpiry.getTime());
  if (next - row.expiresAt.getTime() > 30_000) {
    row.expiresAt = new Date(next);
    await tx.pairWorkspace.update({ where: { id }, data: { expiresAt: row.expiresAt }, select: { id: true } });
  }
  return row;
}
export async function owner(tx: Tx, request: Request) {
  const hash = ownerHash(request);
  requirePair(hash, "start_pairing", 401);
  const workspace = await tx.pairWorkspace.findUnique({ where: { ownerHash: hash }, select: { id: true } });
  requirePair(workspace, "start_pairing", 401);
  return lockWorkspace(tx, workspace.id);
}

export async function bump(tx: Tx, id: string, state?: DemoState) {
  await tx.pairWorkspace.update({ where: { id }, data: {
    revision: { increment: 1 }, ...(state ? { snapshot: jsonValue(state) } : {}),
  }, select: { id: true } });
}
