import type { NextRequest } from "next/server";
import { z } from "zod";
import { idempotencyKeySchema } from "@/lib/validation";
import { ownerError, ownerOk, ownerRoute, readBoundedJson } from "@/lib/owner-http";
import { ownerFromCookie, OWNER_COOKIE } from "@/lib/owner-session";
import { actionTooLarge } from "@/lib/owner-actions/parse";
import { MAX_ACTION_BYTES, ownerAction, ownerStore } from "@/lib/owner-store";

const bodySchema = z.object({
  action: z.unknown(),
  expectedVersion: z.number().int().nonnegative().optional(),
  idempotencyKey: idempotencyKeySchema,
}).strict();

/** The action plus its envelope (version and idempotency key). */
const MAX_BODY_BYTES = MAX_ACTION_BYTES + 1024;

const STATUS = { conflict: 409, rejected: 422, "idempotency-mismatch": 409, "not-found": 404 } as const;

/** Applies one studio change to the signed-in owner's salon. The salon always comes from the session, never the request. */
export function POST(request: NextRequest) {
  return ownerRoute(request, async () => {
    const owner = await ownerFromCookie(request.cookies.get(OWNER_COOKIE)?.value);
    if (!owner) return ownerError("signed_out", 401);
    const json = await readBoundedJson(request, MAX_BODY_BYTES);
    if (json === "too_large") return ownerError("too_large", 413);
    const body = bodySchema.safeParse(json);
    if (body.success && actionTooLarge(body.data.action)) return ownerError("too_large", 413);
    const action = body.success ? ownerAction(body.data.action) : null;
    if (!body.success || !action) return ownerError("invalid", 400);
    const result = await ownerStore().apply(owner.tenantId, action, { actor: "owner", source: "button" },
      { expectedVersion: body.data.expectedVersion, idempotencyKey: body.data.idempotencyKey });
    if (!result.ok) return ownerError(result.reason, STATUS[result.reason]);
    return ownerOk({ state: result.state, version: result.version, replayed: result.replayed });
  });
}
