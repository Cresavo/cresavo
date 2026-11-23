import type { MediaStore } from "./types";

/** The default: the bytes live in the media_asset row itself, so they are in every database backup. */
export const postgresMediaStore: MediaStore = {
  name: "postgres",
  put: async (_key, bytes) => bytes,
  get: async (_key, inline) => (inline ? Buffer.from(inline) : null),
  // The row's deletion removes the bytes.
  delete: async () => {},
};
