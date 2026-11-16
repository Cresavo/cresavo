import { DomainError } from "./errors";

export function isPublicReadonly(env: Record<string, string | undefined> = process.env) {
  return env.PUBLIC_READONLY === "1";
}

export function assertWritable() {
  if (isPublicReadonly()) throw new DomainError("Åtkomst nekad", 403);
}

export function readonlyForbidden() {
  return Response.json({ error: "Åtkomst nekad" }, {
    status: 403, headers: { "Cache-Control": "no-store" },
  });
}

// Also used before page rendering. Block every mutation, including future routes.
export function publicReadonlyResponse(request: Request) {
  if (!isPublicReadonly()) return;
  const path = new URL(request.url).pathname.replace(/\/+$/, "") || "/";
  if (/^\/(?:admin|api\/admin)(?:\/|$)/.test(path) ||
      (!["GET", "HEAD", "OPTIONS"].includes(request.method) &&
       !(request.method === "POST" && path === "/api/locale")))
    return readonlyForbidden();
}
