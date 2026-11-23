import type { NextRequest } from "next/server";
import { z } from "zod";
import { idempotencyKeySchema } from "@/lib/validation";
import { ownerError, ownerOk, ownerRoute, readBoundedJson, fullOwner, refusedOwner, sessionOwner, withRenewedSession } from "@/lib/owner-http";
import { actionTooLarge } from "@/lib/owner-actions/parse";
import { MAX_IMPORT_ACTION_BYTES } from "@/lib/owner-actions/types";
import { ownerAction, ownerStore } from "@/lib/owner-store";
import { SLUG_TAKEN } from "@/concept/store/postgres-studio-store";

const bodySchema = z.object({
  action: z.unknown(),
  expectedVersion: z.number().int().nonnegative().optional(),
  idempotencyKey: idempotencyKeySchema,
}).strict();

/** The body is streamed under the largest action cap plus the envelope (version and idempotency key); the cap for the action's own type is enforced once it is parsed. */
const MAX_BODY_BYTES = MAX_IMPORT_ACTION_BYTES + 1024; // `src/proxy.ts` refuses a larger declared length too, before Next.js buffers the body.

const STATUS = { conflict: 409, rejected: 422, "idempotency-mismatch": 409, "not-found": 404 } as const;

/** Applies one studio change to the signed-in owner's salon. The salon always comes from the session, never the request. */
export function POST(request: NextRequest) {
  return ownerRoute(request, async () => {
    const owner = await sessionOwner(request);
    if (!fullOwner(owner)) return refusedOwner(owner);
    const json = await readBoundedJson(request, MAX_BODY_BYTES);
    if (json === "too_large") return ownerError("too_large", 413);
    const body = bodySchema.safeParse(json);
    if (body.success && actionTooLarge(body.data.action)) return ownerError("too_large", 413);
    const action = body.success ? ownerAction(body.data.action) : null;
    if (!body.success || !action) return ownerError("invalid", 400);
    const result = await ownerStore().apply(owner.tenantId, action, { actor: "owner", source: "button" },
      { expectedVersion: body.data.expectedVersion, idempotencyKey: body.data.idempotencyKey });
    if (!result.ok) return ownerError(result.detail === SLUG_TAKEN ? SLUG_TAKEN : result.reason, STATUS[result.reason]);
    return withRenewedSession(ownerOk({ state: result.state, version: result.version, replayed: result.replayed }), request);
  });
}
