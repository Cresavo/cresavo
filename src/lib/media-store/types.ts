// Where the bytes of a photo or logo are kept. The media_asset row always holds the metadata; a store decides
// whether the bytes go in the row too (Postgres) or in an object store (S3). Objects are private: the app
// serves them itself after its own checks. No store puts a key, a secret or a signed URL in an error.

export type StorageName = "postgres" | "s3";

export interface MediaStore {
  readonly name: StorageName;
  /** Stores the bytes under `key`. Returns what the row's `bytes` column holds: the bytes, or null when they live elsewhere. */
  put(key: string, bytes: Buffer, contentType: string): Promise<Buffer | null>;
  /** The bytes of `key`; `inline` is the row's `bytes` column. Null when the object is gone. */
  get(key: string, inline: Uint8Array | null): Promise<Buffer | null>;
  /** Removes the object of `key`; removing one that is already gone succeeds. */
  delete(key: string): Promise<void>;
}

/** A failure of the object store, with the HTTP status at most: never a key, a secret or a URL. */
export class MediaStoreError extends Error {
  constructor(readonly operation: "put" | "get" | "delete" | "config", readonly status?: number) {
    super(`Media store ${operation} failed${status ? ` (${status})` : ""}`);
  }
}
