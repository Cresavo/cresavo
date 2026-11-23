import { createHash, randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { db } from "../db";
import { checkedKey, mediaKey, mediaStore, storeFor, type MediaStore } from "../media-store";
import { MAX_PHOTOS, MAX_TENANT_MEDIA_BYTES, ownerMediaUrl, PUBLIC_LOGO_URL, publicLogoUrl, RESTORE_WINDOW_MS, type MediaKind } from "./limits";
import { sniffImage, type MediaType } from "./sniff";
import { AnimatedImageError, CorruptImageError, stripMetadata } from "./strip";

// The business's photos and logo. Every function takes the tenant from the caller's session and every query
// names it, so one business never reads, changes or counts another's pictures. Uploads are rebuilt without
// metadata before anything is stored, and the same picture is kept once per business and kind.
//
// A row is `pending` while its bytes are on their way to an object store, and `ready` once they are there
// (the Postgres store writes row and bytes at once). Storage counts against the 500 MB limit until the sweep
// purges it, deleted pictures included. A new logo stays private until the page that uses it is saved
// (`publishPageLogo`), which also retires the logo published before.

type Client = Pick<PrismaClient, "mediaAsset" | "$transaction" | "$queryRaw">;
type Tx = Prisma.TransactionClient;

export interface MediaOptions {
  client?: Client;
  store?: MediaStore;
  now?: Date;
}

export interface MediaSummary {
  id: string;
  kind: MediaKind;
  contentType: MediaType;
  byteSize: number;
  width: number;
  height: number;
  altText: string | null;
  createdAt: string;
  url: string;
  /** The logo's address on the booking page; it answers publicly once a saved page uses it. Photos have none. */
  publicUrl?: string;
}

export type UploadRefusal = "heic" | "unsupported" | "corrupt" | "too_many_pixels" | "animated" | "photo_limit" | "storage_limit" | "busy";
export type UploadResult = { ok: true; asset: MediaSummary; deduped: boolean } | { ok: false; reason: UploadRefusal };

const SUMMARY = { id: true, kind: true, contentType: true, byteSize: true, width: true, height: true, altText: true, createdAt: true, sha256: true, status: true } as const;
type SummaryRow = { id: string; kind: string; contentType: string; byteSize: number; width: number; height: number; altText: string | null; createdAt: Date; sha256: string };

const summary = (row: SummaryRow): MediaSummary => ({
  id: row.id, kind: row.kind as MediaKind, contentType: row.contentType as MediaType, byteSize: row.byteSize, width: row.width, height: row.height,
  altText: row.altText, createdAt: row.createdAt.toISOString(), url: ownerMediaUrl(row.id),
  ...(row.kind === "logo" && { publicUrl: publicLogoUrl(row.id, row.sha256) }),
});

const clientOf = (options: MediaOptions) => options.client ?? (db as unknown as PrismaClient);
const lockTenant = (tx: Tx, tenantId: string) => tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('cresavo:media:' || ${tenantId}))`;
const READY = { status: "ready", deletedAt: null } as const;

/** The picture as it will be stored: its real type, its size as shown (EXIF rotation applied) and its rebuilt bytes. */
export function prepareImage(raw: Uint8Array): { ok: true; type: MediaType; width: number; height: number; bytes: Buffer; sha256: string } | { ok: false; reason: UploadRefusal } {
  const sniffed = sniffImage(raw);
  if (!sniffed.ok) return sniffed;
  let stripped: { bytes: Buffer; orientation: number };
  try {
    stripped = stripMetadata(sniffed.type, raw);
  } catch (error) {
    if (error instanceof CorruptImageError) return { ok: false, reason: "corrupt" };
    if (error instanceof AnimatedImageError) return { ok: false, reason: "animated" };
    throw error;
  }
  const again = sniffImage(stripped.bytes);
  if (!again.ok || again.type !== sniffed.type) return { ok: false, reason: again.ok ? "corrupt" : again.reason };
  const turned = stripped.orientation >= 5;
  return {
    ok: true, type: sniffed.type, bytes: stripped.bytes, sha256: createHash("sha256").update(stripped.bytes).digest("hex"),
    width: turned ? again.height : again.width, height: turned ? again.width : again.height,
  };
}

/** Everything the business has stored and the sweep has not purged yet, deleted and pending pictures included. */
async function retainedBytes(tx: Tx, tenantId: string): Promise<number> {
  const { _sum } = await tx.mediaAsset.aggregate({ where: { tenantId }, _sum: { byteSize: true } });
  return _sum.byteSize ?? 0;
}

/**
 * Stores a photo or a logo. A new logo stays private until a saved page uses it, and replaces a logo that was
 * uploaded but never saved. With an object store, the row is written as pending before the bytes are sent,
 * so a failed or abandoned upload is always found and cleaned up by the sweep.
 */
export async function uploadMedia(tenantId: string, kind: MediaKind, raw: Uint8Array, options: MediaOptions = {}): Promise<UploadResult> {
  const image = prepareImage(raw);
  if (!image.ok) return image;
  const client = clientOf(options);
  const twinOf = { tenantId, kind, sha256: image.sha256, deletedAt: null };
  const known = await client.mediaAsset.findFirst({ where: { ...twinOf, status: "ready" }, select: SUMMARY });
  if (known) return { ok: true, asset: summary(known), deduped: true };

  const store = options.store ?? mediaStore();
  const id = randomUUID();
  const storageKey = mediaKey(tenantId, id);
  const now = options.now ?? new Date();
  // The Postgres store keeps the bytes in the row itself; an object store gets them after the row exists.
  const inline = store.name === "postgres" ? await store.put(storageKey, image.bytes, image.type) : null;
  const outcome = await client.$transaction(async (tx): Promise<UploadResult & { created?: boolean }> => {
    // One upload per business at a time, so two at once cannot both fit under the limits.
    await lockTenant(tx, tenantId);
    const twin = await tx.mediaAsset.findFirst({ where: twinOf, select: SUMMARY });
    if (twin) return twin.status === "ready" ? { ok: true, asset: summary(twin), deduped: true } : { ok: false, reason: "busy" };
    if (kind === "photo" && (await tx.mediaAsset.count({ where: { tenantId, kind: "photo", deletedAt: null } })) >= MAX_PHOTOS) return { ok: false, reason: "photo_limit" };
    if ((await retainedBytes(tx, tenantId)) + image.bytes.length > MAX_TENANT_MEDIA_BYTES) return { ok: false, reason: "storage_limit" };
    // A logo uploaded but never saved with a page is replaced; the sweep purges it soon (sweep.ts).
    if (kind === "logo") await tx.mediaAsset.updateMany({ where: { tenantId, kind: "logo", publishedAt: null, deletedAt: null }, data: { deletedAt: now } });
    const row = await tx.mediaAsset.create({
      data: {
        id, tenantId, kind, contentType: image.type, byteSize: image.bytes.length, width: image.width, height: image.height, sha256: image.sha256,
        storage: store.name, storageKey, status: inline ? "ready" : "pending", bytes: inline ? new Uint8Array(inline) : null, createdAt: now,
      },
      select: SUMMARY,
    });
    return { ok: true, asset: summary(row), deduped: false, created: true };
  });
  if (!outcome.ok || !outcome.created || inline) return outcome.ok ? { ok: true, asset: outcome.asset, deduped: outcome.deduped } : outcome;
  try {
    await store.put(storageKey, image.bytes, image.type);
  } catch (error) {
    // Still pending: the sweep removes the row and any partial object.
    await client.mediaAsset.updateMany({ where: { id, tenantId, status: "pending" }, data: { deletedAt: new Date() } }).catch(() => {});
    throw error;
  }
  await client.mediaAsset.updateMany({ where: { id, tenantId, status: "pending", deletedAt: null }, data: { status: "ready" } });
  return { ok: true, asset: outcome.asset, deduped: false };
}

/** The business's ready pictures, newest first. */
export async function listMedia(tenantId: string, options: MediaOptions = {}): Promise<MediaSummary[]> {
  const rows = await clientOf(options).mediaAsset.findMany({
    where: { tenantId, ...READY }, select: SUMMARY, orderBy: [{ createdAt: "desc" }, { id: "asc" }],
  });
  return rows.map(summary);
}

export interface StoredMedia {
  id: string;
  tenantId: string;
  kind: MediaKind;
  contentType: MediaType;
  byteSize: number;
  sha256: string;
  /** Reads the bytes from wherever they are kept; null when they are gone. */
  bytes: () => Promise<Buffer | null>;
}

const STORED = { id: true, tenantId: true, kind: true, contentType: true, byteSize: true, sha256: true, storage: true, storageKey: true } as const;
type StoredRow = { id: string; tenantId: string; kind: string; contentType: string; byteSize: number; sha256: string; storage: string; storageKey: string };

function stored(client: Client, row: StoredRow): StoredMedia {
  return {
    id: row.id, tenantId: row.tenantId, kind: row.kind as MediaKind, contentType: row.contentType as MediaType, byteSize: row.byteSize, sha256: row.sha256,
    bytes: async () => {
      const key = checkedKey(row);
      const inline = row.storage === "postgres"
        ? (await client.mediaAsset.findFirst({ where: { id: row.id, tenantId: row.tenantId }, select: { bytes: true } }))?.bytes ?? null
        : null;
      return storeFor(row.storage).get(key, inline);
    },
  };
}

/** One ready picture of this business; null for anything else, including another business's picture. */
export async function findMedia(tenantId: string, id: string, options: MediaOptions = {}): Promise<StoredMedia | null> {
  const client = clientOf(options);
  const row = await client.mediaAsset.findFirst({ where: { id, tenantId, ...READY }, select: STORED });
  return row ? stored(client, row) : null;
}

/**
 * The logo with this id and hash, and whether anyone may see it: only when it is published and its business's
 * saved booking page uses it. Otherwise only its own owner may (`tenantId`), for the editor's preview.
 */
export async function findLogo(id: string, sha256: string, options: MediaOptions = {}): Promise<{ media: StoredMedia; published: boolean } | null> {
  const client = clientOf(options);
  const row = await client.mediaAsset.findFirst({ where: { id, sha256, kind: "logo", ...READY }, select: { ...STORED, publishedAt: true } });
  if (!row) return null;
  const used = row.publishedAt ? await client.$queryRaw<{ used: boolean }[]>`
    SELECT true AS used FROM tenant_state WHERE tenant_id = ${row.tenantId} AND kind = 'salon' AND doc #>> '{page,theme,logo}' = ${publicLogoUrl(id, sha256)}` : [];
  return { media: stored(client, row), published: used.length > 0 };
}

/** Sets or clears a picture's description. Null when the business has no such ready picture. */
export async function setAltText(tenantId: string, id: string, altText: string | null, options: MediaOptions = {}): Promise<MediaSummary | null> {
  const client = clientOf(options);
  const { count } = await client.mediaAsset.updateMany({ where: { id, tenantId, ...READY }, data: { altText } });
  if (!count) return null;
  const row = await client.mediaAsset.findFirst({ where: { id, tenantId }, select: SUMMARY });
  return row ? summary(row) : null;
}

/** Moves a picture to the deleted ones; the sweep purges it later. False when the business has no such ready picture. */
export async function deleteMedia(tenantId: string, id: string, options: MediaOptions = {}): Promise<boolean> {
  const { count } = await clientOf(options).mediaAsset.updateMany({ where: { id, tenantId, ...READY }, data: { deletedAt: options.now ?? new Date() } });
  return count > 0;
}

/**
 * Brings back a photo deleted within the restore window ("Undo"). Its bytes still count towards the limit, so
 * only the photo count and a twin uploaded again meanwhile can refuse it. Logos come back by saving a page.
 */
export async function restoreMedia(tenantId: string, id: string, options: MediaOptions = {}): Promise<{ ok: true; asset: MediaSummary } | { ok: false; reason: "not_found" | "conflict" }> {
  const client = clientOf(options);
  const now = options.now ?? new Date();
  return client.$transaction(async (tx) => {
    await lockTenant(tx, tenantId);
    const row = await tx.mediaAsset.findFirst({ where: { id, tenantId, kind: "photo", status: "ready", deletedAt: { gt: new Date(now.getTime() - RESTORE_WINDOW_MS) } }, select: SUMMARY });
    if (!row) return { ok: false as const, reason: "not_found" as const };
    const live = { tenantId, kind: "photo", deletedAt: null };
    const clash = await tx.mediaAsset.count({ where: { ...live, sha256: row.sha256 } });
    if (clash || (await tx.mediaAsset.count({ where: live })) >= MAX_PHOTOS) return { ok: false as const, reason: "conflict" as const };
    await tx.mediaAsset.updateMany({ where: { id, tenantId }, data: { deletedAt: null } });
    return { ok: true as const, asset: summary(row) };
  });
}

// ---------------------------------------------------------------------------- The logo and the saved page

export type PageLogoRefusal = "logo_inline" | "logo_unknown";

/**
 * Whether an account salon's page may be saved with this logo: none, the logo it already has (an older inline
 * image is kept as it is), or a logo of this business from the library. A new inline image is refused: it
 * would skip the checks and the metadata removal of an upload.
 */
export async function checkPageLogo(tenantId: string, logo: string | null, current: string | null, options: MediaOptions = {}): Promise<PageLogoRefusal | null> {
  if (logo === null || logo === current) return null;
  if (!PUBLIC_LOGO_URL.test(logo)) return "logo_inline";
  const [, , , , id, sha256] = logo.split("/");
  const row = await clientOf(options).mediaAsset.findFirst({ where: { id, sha256, tenantId, kind: "logo", ...READY }, select: { id: true } });
  return row ? null : "logo_unknown";
}

/** The logo a saved page names is gone or not this business's: the save is refused. */
export class PageLogoGone extends Error {}

/**
 * Runs inside the transaction that saves the page (`ApplyOptions.beforeCommit`): publishes the logo the page
 * uses and retires the one published before, or retires it when the page has none. An inline image or the
 * logo that is already published changes nothing.
 */
export async function publishPageLogo(tx: Tx, tenantId: string, logo: string | null, now = new Date()): Promise<void> {
  await lockTenant(tx, tenantId);
  const published = { tenantId, kind: "logo", deletedAt: null, publishedAt: { not: null } };
  if (logo === null) {
    await tx.mediaAsset.updateMany({ where: published, data: { deletedAt: now } });
    return;
  }
  if (!PUBLIC_LOGO_URL.test(logo)) return;
  const [, , , , id, sha256] = logo.split("/");
  const row = await tx.mediaAsset.findFirst({ where: { id, sha256, tenantId, kind: "logo", ...READY }, select: { publishedAt: true } });
  if (!row) throw new PageLogoGone();
  if (row.publishedAt) return;
  await tx.mediaAsset.updateMany({ where: published, data: { deletedAt: now } });
  await tx.mediaAsset.updateMany({ where: { id, tenantId }, data: { publishedAt: now } });
}
