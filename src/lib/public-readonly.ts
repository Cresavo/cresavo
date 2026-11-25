import { pairingOrigin, PUBLIC_WRITES } from "../concept/pairing/policy";
import { DomainError } from "./errors";

export function isPublicReadonly(env: Record<string, string | undefined> = process.env) {
  return env.PUBLIC_READONLY === "1";
}

export function assertWritable() {
  if (isPublicReadonly()) throw new DomainError("Access denied.", 403);
}

export function readonlyForbidden() {
  return Response.json({ error: "Access denied." }, {
    status: 403, headers: { "Cache-Control": "no-store" },
  });
}

// Also used before page rendering. Block every mutation, including future routes.
// The launch waiting list is the one public write that stays open: it has its own validation and rate limit.
// The poster renderer is a POST only because its photos do not fit a URL: it stores nothing,
// accepts same-origin requests only and has its own size and rate limits.
// The demo register's pay requests (creating one, paying one) hold an amount for ten minutes in process memory,
// never customer data: same-origin only, with their own limits (src/concept/register/pay-request-http.ts).
const REGISTER_PAY_WRITE = /^\/api\/concept\/register\/pay-requests(?:\/[\w.-]{1,160}\/pay)?$/;
export function publicReadonlyResponse(request: Request) {
  if (!isPublicReadonly()) return;
  const path = new URL(request.url).pathname.replace(/\/+$/, "") || "/";
  if (request.method === "POST" && PUBLIC_WRITES.has(path) && pairingOrigin(request.headers)) return;
  if (/^\/(?:admin|api\/admin)(?:\/|$)/.test(path) ||
      (!["GET", "HEAD", "OPTIONS"].includes(request.method) &&
       !(request.method === "POST" && (path === "/api/locale" || path === "/api/waitlist" || path === "/api/concept/poster" || REGISTER_PAY_WRITE.test(path)))))
    return readonlyForbidden();
}
