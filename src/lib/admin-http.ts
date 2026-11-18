import { getAdminContext, sameOrigin } from "./auth";
import { DomainError } from "./errors";
import { idempotencyKeySchema } from "./validation";

export async function requireAdmin(write = false) {
  if (write && !(await sameOrigin()))
    throw new DomainError("Access denied.", 403);
  const admin = await getAdminContext();
  if (!admin) throw new DomainError("Access denied.", 403);
  return { kind: "admin" as const, id: admin.id };
}

export function requestId(headers: Headers) {
  return idempotencyKeySchema.parse(headers.get("Idempotency-Key"));
}
