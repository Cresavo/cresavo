import { createHash, randomUUID } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { db } from "../db";
import { mediaStore, storeFor, type MediaStore } from "../media-store";
import { MAX_PHOTOS, MAX_TENANT_MEDIA_BYTES, ownerMediaUrl, publicLogoUrl, RESTORE_WINDOW_MS, type MediaKind } from "./limits";
import { sniffImage, type MediaType } from "./sniff";
import { CorruptImageError, stripMetadata } from "./strip";

// The business's photos and logo. Every function takes the tenant from the caller's session and every query
// names it, so one business never reads, changes or counts another's pictures. Uploads are cleaned of
// metadata before anything is stored, and the same picture is kept once per business and kind.

type Client = Pick<PrismaClient, "mediaAsset" | "$transaction">;

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
  /** The logo's public address; photos have none. */
  publicUrl?: string;
}

export type UploadRefusal = "heic" | "unsupported" | "corrupt" | "too_many_pixels" | "photo_limit" | "storage_limit";
export type UploadResult = { ok: true; asset: MediaSummary; deduped: boolean } | { ok: false; reason: UploadRefusal };

const SUMMARY = { id: true, kind: true, contentType: true, byteSize: true, width: true, height: true, altText: true, createdAt: true, sha256: true } as const;
type SummaryRow = { id: string; kind: string; contentType: string; byteSize: number; width: number; height: number; altText: string | null; createdAt: Date; sha256: string };

const summary = (row: SummaryRow): MediaSummary => ({
  id: row.id, kind: row.kind as MediaKind, contentType: row.contentType as MediaType, byteSize: row.byteSize, width: row.width, height: row.height,
  altText: row.altText, createdAt: row.createdAt.toISOString(), url: ownerMediaUrl(row.id),
  ...(row.kind === "logo" && { publicUrl: publicLogoUrl(row.id, row.sha256) }),
});

const clientOf = (options: MediaOptions) => options.client ?? (db as unknown as PrismaClient);

/** The picture as it will be stored: its real type, its size as shown (EXIF rotation applied) and its bytes without metadata. */
export function prepareImage(raw: Uint8Array): { ok: true; type: MediaType; width: number; height: number; bytes: Buffer; sha256: string } | { ok: false; reason: UploadRefusal } {
  const sniffed = sniffImage(raw);
  if (!sniffed.ok) return sniffed;
  let stripped: { bytes: Buffer; orientation: number };
  try {
    stripped = stripMetadata(sniffed.type, raw);
  } catch (error) {
    if (error instanceof CorruptImageError) return { ok: false, reason: "corrupt" };
    throw error;
  }
  const again = sniffImage(stripped.bytes);
  if (!again.ok || again.type !== sniffed.type) return { ok: false, reason: "corrupt" };
  const turned = stripped.orientation >= 5;
  return {
    ok: true, type: sniffed.type, bytes: stripped.bytes, sha256: createHash("sha256").update(stripped.bytes).digest("hex"),
    width: turned ? again.height : again.width, height: turned ? again.width : again.height,
  };
}

/**
 * Stores a photo or the logo. A new logo replaces the active one (which is deleted, and purged later). An
 * object store receives the bytes before the row is written and loses them again if the row is not.
 */
export async function uploadMedia(tenantId: string, kind: MediaKind, raw: Uint8Array, options: MediaOptions = {}): Promise<UploadResult> {
  const image = prepareImage(raw);
  if (!image.ok) return image;
  const client = clientOf(options);
  const active = { tenantId, kind, sha256: image.sha256, deletedAt: null };
  const known = await client.mediaAsset.findFirst({ where: active, select: SUMMARY });
  if (known) return { ok: true, asset: summary(known), deduped: true };

  const store = options.store ?? mediaStore();
  const id = randomUUID();
  const storageKey = `media/${id}`;
  const inline = await store.put(storageKey, image.bytes, image.type);
  let outcome: UploadResult & { created?: boolean };
  try {
    outcome = await client.$transaction(async (tx) => {
      // One upload per business at a time, so two at once cannot both fit under the limits or both become the logo.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('cresavo:media:' || ${tenantId}))`;
      const twin = await tx.mediaAsset.findFirst({ where: active, select: SUMMARY });
      if (twin) return { ok: true as const, asset: summary(twin), deduped: true };
      const live = { tenantId, deletedAt: null };
      if (kind === "photo" && (await tx.mediaAsset.count({ where: { ...live, kind: "photo" } })) >= MAX_PHOTOS) return { ok: false as const, reason: "photo_limit" as const };
      const replaced = kind === "logo" ? await tx.mediaAsset.findFirst({ where: { ...live, kind: "logo" }, select: { byteSize: true } }) : null;
      const { _sum } = await tx.mediaAsset.aggregate({ where: live, _sum: { byteSize: true } });
      if ((_sum.byteSize ?? 0) - (replaced?.byteSize ?? 0) + image.bytes.length > MAX_TENANT_MEDIA_BYTES) return { ok: false as const, reason: "storage_limit" as const };
      if (kind === "logo") await tx.mediaAsset.updateMany({ where: { ...live, kind: "logo" }, data: { deletedAt: options.now ?? new Date() } });
      const row = await tx.mediaAsset.create({
        data: {
          id, tenantId, kind, contentType: image.type, byteSize: image.bytes.length, width: image.width, height: image.height, sha256: image.sha256,
          storage: store.name, storageKey, bytes: inline ? new Uint8Array(inline) : null, ...(options.now && { createdAt: options.now }),
        },
        select: SUMMARY,
      });
      return { ok: true as const, asset: summary(row), deduped: false, created: true };
    });
  } catch (error) {
    if (!inline) await store.delete(storageKey).catch(() => {});
    throw error;
  }
  if (!outcome.created && !inline) await store.delete(storageKey).catch(() => {});
  if (!outcome.ok) return outcome;
  return { ok: true, asset: outcome.asset, deduped: outcome.deduped };
}

/** The business's active pictures, newest first. */
export async function listMedia(tenantId: string, options: MediaOptions = {}): Promise<MediaSummary[]> {
  const rows = await clientOf(options).mediaAsset.findMany({
    where: { tenantId, deletedAt: null }, select: SUMMARY, orderBy: [{ createdAt: "desc" }, { id: "asc" }],
  });
  return rows.map(summary);
}

export interface StoredMedia {
  id: string;
  kind: MediaKind;
  contentType: MediaType;
  byteSize: number;
  sha256: string;
  /** Reads the bytes from wherever they are kept; null when they are gone. */
  bytes: () => Promise<Buffer | null>;
}

function stored(client: Client, row: { id: string; kind: string; contentType: string; byteSize: number; sha256: string; storage: string; storageKey: string }): StoredMedia {
  return {
    id: row.id, kind: row.kind as MediaKind, contentType: row.contentType as MediaType, byteSize: row.byteSize, sha256: row.sha256,
    bytes: async () => {
      const inline = row.storage === "postgres"
        ? (await client.mediaAsset.findUnique({ where: { id: row.id }, select: { bytes: true } }))?.bytes ?? null
        : null;
      return storeFor(row.storage).get(row.storageKey, inline);
    },
  };
}

const STORED = { id: true, kind: true, contentType: true, byteSize: true, sha256: true, storage: true, storageKey: true } as const;

/** One active picture of this business; null for anything else, including another business's picture. */
export async function findMedia(tenantId: string, id: string, options: MediaOptions = {}): Promise<StoredMedia | null> {
  const client = clientOf(options);
  const row = await client.mediaAsset.findFirst({ where: { id, tenantId, deletedAt: null }, select: STORED });
  return row ? stored(client, row) : null;
}

/** The active logo with this id and hash, whichever business it is: the only picture anyone may read without signing in. */
export async function findPublicLogo(id: string, sha256: string, options: MediaOptions = {}): Promise<StoredMedia | null> {
  const client = clientOf(options);
  const row = await client.mediaAsset.findFirst({ where: { id, sha256, kind: "logo", deletedAt: null }, select: STORED });
  return row ? stored(client, row) : null;
}

/** Sets or clears a picture's description. Null when the business has no such active picture. */
export async function setAltText(tenantId: string, id: string, altText: string | null, options: MediaOptions = {}): Promise<MediaSummary | null> {
  const client = clientOf(options);
  const { count } = await client.mediaAsset.updateMany({ where: { id, tenantId, deletedAt: null }, data: { altText } });
  if (!count) return null;
  const row = await client.mediaAsset.findFirst({ where: { id, tenantId }, select: SUMMARY });
  return row ? summary(row) : null;
}

/** Moves a picture to the deleted ones; the sweep purges it later. False when the business has no such active picture. */
export async function deleteMedia(tenantId: string, id: string, options: MediaOptions = {}): Promise<boolean> {
  const { count } = await clientOf(options).mediaAsset.updateMany({ where: { id, tenantId, deletedAt: null }, data: { deletedAt: options.now ?? new Date() } });
  return count > 0;
}

/**
 * Brings back a picture deleted within the restore window ("Undo"). Refused for a logo once another one is
 * active, for a photo whose twin was uploaded again meanwhile (both would break the one-active rule) and
 * for a photo the library has no room for any more.
 */
export async function restoreMedia(tenantId: string, id: string, options: MediaOptions = {}): Promise<{ ok: true; asset: MediaSummary } | { ok: false; reason: "not_found" | "conflict" }> {
  const client = clientOf(options);
  const now = options.now ?? new Date();
  return client.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('cresavo:media:' || ${tenantId}))`;
    const row = await tx.mediaAsset.findFirst({ where: { id, tenantId, deletedAt: { gt: new Date(now.getTime() - RESTORE_WINDOW_MS) } }, select: SUMMARY });
    if (!row) return { ok: false as const, reason: "not_found" as const };
    const live = { tenantId, deletedAt: null };
    const clash = await tx.mediaAsset.count({ where: row.kind === "logo" ? { ...live, kind: "logo" } : { ...live, kind: row.kind, sha256: row.sha256 } });
    const full = row.kind === "photo" && (await tx.mediaAsset.count({ where: { ...live, kind: "photo" } })) >= MAX_PHOTOS;
    const { _sum } = await tx.mediaAsset.aggregate({ where: live, _sum: { byteSize: true } });
    if (clash || full || (_sum.byteSize ?? 0) + row.byteSize > MAX_TENANT_MEDIA_BYTES) return { ok: false as const, reason: "conflict" as const };
    await tx.mediaAsset.updateMany({ where: { id, tenantId }, data: { deletedAt: null } });
    return { ok: true as const, asset: summary(row) };
  });
}
