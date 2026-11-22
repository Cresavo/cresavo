// The HTTP entry point refuses an oversized owner action body before Next.js clones and buffers it
// (it does so before it calls the proxy, 10 MiB by default). Kept apart from server.mjs to be testable.

export const OWNER_ACTIONS_PATH = "/api/owner/salon/actions";
// The route's largest action cap (2.5 MiB, a customer import) plus the envelope; a test keeps it equal to src/lib/owner-actions/types.ts.
export const OWNER_ACTIONS_MAX_BODY_BYTES = 2.5 * 1024 * 1024 + 1024;

/** The status to refuse an owner action POST with before any of its body is read, or 0 to let it through. */
export function ownerActionRefusal(method, url, headers) {
  if (method !== "POST") return 0;
  const path = (url ?? "").split("?")[0].replace(/\/+$/, "");
  if (path !== OWNER_ACTIONS_PATH) return 0;
  // A body with no declared length cannot be bounded here.
  if (headers["transfer-encoding"] && headers["content-length"] === undefined) return 411;
  return Number(headers["content-length"] ?? 0) > OWNER_ACTIONS_MAX_BODY_BYTES ? 413 : 0;
}
