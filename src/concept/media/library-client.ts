"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { MediaSummary } from "@/lib/media/library";
import { MAX_MEDIA_BYTES, type MediaKind } from "@/lib/media/limits";
import type { MessageKey } from "../i18n";

// The signed-in owner's photo library in the browser: one shared list for the Photos page, the logo field and
// the poster's photo picker. A photo the server cannot take as it is (HEIC from an iPhone, or a file over
// 8 MB) is drawn on a canvas first and sent as a JPEG; the browser applies the photo's rotation, and the copy
// carries no metadata.

export type { MediaSummary } from "@/lib/media/library";

const API = "/api/owner/media";
const ACCEPTED = new Set(["image/jpeg", "image/png", "image/webp"]);
const CONVERTED_SIDE = 4096;

let items: MediaSummary[] | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
const set = (next: MediaSummary[]) => { items = next; emit(); };

/** Reads the library from the server again. */
export function reloadLibrary(): Promise<void> {
  loading ??= fetch(API, { credentials: "same-origin" })
    .then(async (response) => { if (response.ok) set(((await response.json()) as { media: MediaSummary[] }).media); })
    .catch(() => {})
    .finally(() => { loading = null; });
  return loading;
}

/** The library, loaded once when first used; null until it has loaded (or while signed out). */
export function useLibrary(enabled = true): MediaSummary[] | null {
  const list = useSyncExternalStore((listener) => { listeners.add(listener); return () => listeners.delete(listener); }, () => items, () => null);
  useEffect(() => { if (enabled && items === null) void reloadLibrary(); }, [enabled]);
  return enabled ? list : null;
}

/** The library's photos (not the logo). */
export const photosOf = (list: MediaSummary[] | null) => (list ?? []).filter((item) => item.kind === "photo");

const ERRORS: Record<string, MessageKey> = {
  heic: "photos.error.heic", unsupported: "photos.error.unsupported", corrupt: "photos.error.corrupt", too_many_pixels: "photos.error.tooBig",
  too_large: "photos.error.tooBig", photo_limit: "photos.error.photoLimit", storage_limit: "photos.error.storageLimit",
  signed_out: "photos.error.signedOut", mfa_required: "photos.error.signedOut",
};
const errorOf = (code: unknown, status: number): MessageKey => (status === 429 ? "photos.error.rateLimited" : ERRORS[String(code)] ?? "photos.error.failed");

/** The file as a JPEG drawn on a canvas, at most 4096 px on its longest side. Null when this browser cannot decode it. */
async function asJpeg(file: Blob): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, CONVERTED_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    for (const quality of [0.9, 0.8, 0.65]) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size <= MAX_MEDIA_BYTES) return blob;
    }
  } catch {
    // Not a picture this browser can read.
  }
  return null;
}

const looksHeic = (file: File) => /hei[cf]/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);

/** What is sent for a picked file: the file itself when the server takes it, otherwise a JPEG copy. */
export async function uploadable(file: File): Promise<Blob | { error: MessageKey }> {
  if (ACCEPTED.has(file.type) && file.size <= MAX_MEDIA_BYTES) return file;
  const converted = await asJpeg(file);
  if (converted) return converted;
  return { error: looksHeic(file) ? "photos.error.heic" : file.size > MAX_MEDIA_BYTES ? "photos.error.tooBig" : "photos.error.unsupported" };
}

export type UploadAnswer = { ok: true; asset: MediaSummary; deduped: boolean } | { ok: false; error: MessageKey };

/** Uploads one picked file to the library; a new logo replaces the old one. */
export async function uploadPicture(file: File, kind: MediaKind = "photo"): Promise<UploadAnswer> {
  const body = await uploadable(file);
  if ("error" in body) return { ok: false, error: body.error };
  try {
    const response = await fetch(`${API}?kind=${kind}`, { method: "POST", credentials: "same-origin", headers: { "content-type": body.type || "application/octet-stream" }, body });
    const answer = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, error: errorOf(answer.error, response.status) };
    const asset = answer.asset as MediaSummary;
    set([asset, ...(items ?? []).filter((item) => item.id !== asset.id && !(kind === "logo" && item.kind === "logo"))]);
    return { ok: true, asset, deduped: !!answer.deduped };
  } catch {
    return { ok: false, error: "photos.error.failed" };
  }
}

async function send(path: string, init: RequestInit): Promise<MediaSummary | true | null> {
  try {
    const response = await fetch(path, { credentials: "same-origin", ...init });
    if (!response.ok) return null;
    const answer = await response.json().catch(() => ({}));
    return (answer.asset as MediaSummary | undefined) ?? true;
  } catch {
    return null;
  }
}

/** Saves a picture's description; false when it could not be saved. */
export async function describePicture(id: string, altText: string): Promise<boolean> {
  const asset = await send(`${API}/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ altText: altText.trim() || null }) });
  if (asset && asset !== true) set((items ?? []).map((item) => (item.id === id ? asset : item)));
  return !!asset;
}

/** Deletes a picture; it can be brought back with `restorePicture` for a day. */
export async function deletePicture(id: string): Promise<boolean> {
  const done = await send(`${API}/${id}`, { method: "DELETE" });
  if (done) set((items ?? []).filter((item) => item.id !== id));
  return !!done;
}

export async function restorePicture(id: string): Promise<boolean> {
  const asset = await send(`${API}/${id}/restore`, { method: "POST" });
  if (asset && asset !== true) set([asset, ...(items ?? []).filter((item) => item.id !== id)].sort((x, y) => y.createdAt.localeCompare(x.createdAt)));
  return !!asset;
}
