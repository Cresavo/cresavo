// Limits of the photo library, shared by the server and the studio. Kept free of server imports.

export const MEDIA_KINDS = ["photo", "logo"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

/** One file, as the server receives it. */
export const MAX_MEDIA_BYTES = 8 * 1024 * 1024;
export const MAX_PHOTOS = 300;
/** Everything one business has stored and not deleted, photos and logo together. */
export const MAX_TENANT_MEDIA_BYTES = 500 * 1024 * 1024;
export const MAX_ALT_TEXT = 300;
/** A deleted photo can be brought back for this long ("Undo"); the sweep purges it after PURGE_AFTER_DAYS. */
export const RESTORE_WINDOW_MS = 24 * 60 * 60 * 1000;
export const PURGE_AFTER_DAYS = 30;

export const MEDIA_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Where the signed-in owner reads one of their pictures. */
export const ownerMediaUrl = (id: string) => `/api/owner/media/${id}`;
/** The public address of the active logo: its id and the hash of its bytes, so it cannot be guessed. */
export const publicLogoUrl = (id: string, sha256: string) => `/api/public/media/${id}/${sha256}`;
export const PUBLIC_LOGO_URL = /^\/api\/public\/media\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/[0-9a-f]{64}$/;
const OWNER_MEDIA_URL = /^\/api\/owner\/media\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/;

/** The library id of a picture address the studio uses, or null when it is not a library picture. */
export const libraryIdOf = (url: string | undefined) => (url ? OWNER_MEDIA_URL.exec(url)?.[1] ?? null : null);

/** How a poster request names a library photo instead of carrying it: the renderer reads it itself. */
export const POSTER_PHOTO_FIELDS = ["photo", "before"] as const;
export const posterPhotoRef = (id: string) => `media:${id}`;
export const posterPhotoRefId = (value: unknown) => (typeof value === "string" && value.startsWith("media:") ? value.slice(6) : null);

/** True when a poster request names a library photo. */
export function namesLibraryPhoto(body: unknown): boolean {
  const data = (body as { data?: Record<string, unknown> } | null)?.data;
  return !!data && typeof data === "object" && POSTER_PHOTO_FIELDS.some((field) => posterPhotoRefId(data[field]) !== null);
}
