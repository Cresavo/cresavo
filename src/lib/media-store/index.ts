import { postgresMediaStore } from "./postgres";
import { s3ConfigFromEnv, s3MediaStore } from "./s3";
import { MediaStoreError, type MediaStore } from "./types";

// MEDIA_STORE picks where new photos go: `postgres` (the default) or `s3`. A row remembers its own store, so
// photos uploaded before a switch are still served and purged from where they are.

export type { MediaStore, StorageName } from "./types";
export { MediaStoreError } from "./types";

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
