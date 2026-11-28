// The HTTP entry point refuses an oversized owner body before Next.js clones and buffers it
// (it does so before it calls the proxy, 10 MiB by default). Kept apart from server.mjs to be testable.

export const OWNER_ACTIONS_PATH = "/api/owner/salon/actions";
// The route's largest action cap (2.5 MiB, a customer import) plus the envelope; a test keeps it equal to src/lib/owner-actions/types.ts.
export const OWNER_ACTIONS_MAX_BODY_BYTES = 2.5 * 1024 * 1024 + 1024;
export const OWNER_MEDIA_PATH = "/api/owner/media";
// One picture, the raw request body; a test keeps it equal to src/lib/media/limits.ts.
export const OWNER_MEDIA_MAX_BODY_BYTES = 8 * 1024 * 1024;
// Kept equal to LOGIN_MAX_BODY_BYTES in src/lib/bounded-json.ts.
export const LOGIN_MAX_BODY_BYTES = 8 * 1024;

/** The cap of a protected POST body, by path; undefined for every other request. */
export function ownerBodyCap(method, path) {
  if (method !== "POST") return undefined;
  const bare = (path ?? "").split("?")[0].replace(/\/+$/, "");
  return bare === OWNER_ACTIONS_PATH ? OWNER_ACTIONS_MAX_BODY_BYTES : bare === OWNER_MEDIA_PATH ? OWNER_MEDIA_MAX_BODY_BYTES :
    ["/api/owner/login", "/api/admin/login"].includes(bare) ? LOGIN_MAX_BODY_BYTES : undefined;
}

/** The status to refuse a protected POST with before any of its body is read, or 0 to let it through. */
export function ownerActionRefusal(method, url, headers) {
  const cap = ownerBodyCap(method, url);
  if (cap === undefined) return 0;
  // A body with no declared length cannot be bounded here.
  if (headers["transfer-encoding"] && headers["content-length"] === undefined) return 411;
  return Number(headers["content-length"] ?? 0) > cap ? 413 : 0;
}
