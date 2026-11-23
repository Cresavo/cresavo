import { postgresMediaStore } from "./postgres";
import { s3ConfigFromEnv, s3MediaStore } from "./s3";
import { MediaStoreError, type MediaStore } from "./types";

// MEDIA_STORE picks where new photos go: `postgres` (the default) or `s3`. A row remembers its own store, so
// photos uploaded before a switch are still served and purged from where they are.

export type { MediaStore, StorageName } from "./types";
export { MediaStoreError } from "./types";

const TENANT = /^[A-Za-z0-9_-]{1,100}$/;
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/**
 * The object key of a picture: always derived from its tenant and row id, never taken from elsewhere. The
 * database checks the same relationship (media_asset_storage_key_check), and every read and delete checks it
 * again, so a wrong row cannot point the store at another object.
 */
export function mediaKey(tenantId: string, id: string): string {
  if (!TENANT.test(tenantId) || !ID.test(id)) throw new MediaStoreError("config");
  return `media/${tenantId}/${id}`;
}

/** The stored key of a row, once it is checked to be the one its tenant and id give. */
export function checkedKey(row: { tenantId: string; id: string; storageKey: string }): string {
  const key = mediaKey(row.tenantId, row.id);
  if (row.storageKey !== key) throw new MediaStoreError("config");
  return key;
}

let s3: MediaStore | undefined;

function s3Store(): MediaStore {
  s3 ??= s3MediaStore(s3ConfigFromEnv());
  return s3;
}

/** The store new uploads go to. */
export function mediaStore(env: NodeJS.ProcessEnv = process.env): MediaStore {
  const chosen = env.MEDIA_STORE ?? "postgres";
  if (chosen === "postgres") return postgresMediaStore;
  if (chosen === "s3") return s3Store();
  throw new MediaStoreError("config");
}

/** The store a stored row's bytes are in. */
export function storeFor(storage: string): MediaStore {
  if (storage === "postgres") return postgresMediaStore;
  if (storage === "s3") return s3Store();
  throw new MediaStoreError("config");
}
