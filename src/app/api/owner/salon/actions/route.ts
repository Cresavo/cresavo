import type { Prisma } from "@prisma/client";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { idempotencyKeySchema } from "@/lib/validation";
import { ownerError, ownerOk, ownerRoute, readBoundedJson, fullOwner, refusedOwner, sessionOwner, withRenewedSession } from "@/lib/owner-http";
import { actionTooLarge } from "@/lib/owner-actions/parse";
import { MAX_IMPORT_ACTION_BYTES } from "@/lib/owner-actions/types";
import { ownerAction, ownerStore } from "@/lib/owner-store";
import { JOURNALS_UNAVAILABLE, SLUG_TAKEN } from "@/concept/store/postgres-studio-store";
import { journalsOnServer, salonForBrowser } from "@/lib/owner-journals";
import { checkPageLogo, PageLogoGone, publishPageLogo } from "@/lib/media/library";

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
    // With server-side journals, journal text is only accepted by /api/owner/journals (its own limits), and a read is
    // only logged where the server hands the text out: a read the studio reports is refused.
    if (journalsOnServer() && (action.type === "journal/add" || action.type === "journal/edit" || action.type === "journal/view")) return ownerError("journal_route", 400);
    const store = ownerStore();
    // The page's logo: a library logo of this business, published in the same transaction as the save.
    const logo = action.type === "page/set" ? action.page.theme?.logo ?? null : undefined;
    if (logo !== undefined) {
      const refused = await checkPageLogo(owner.tenantId, logo, (await store.load(owner.tenantId))?.state.page?.theme?.logo ?? null);
      if (refused) return ownerError(refused, 422);
    }
    let result;
    try {
      result = await store.apply(owner.tenantId, action, { actor: "owner", source: "button" }, {
        expectedVersion: body.data.expectedVersion, idempotencyKey: body.data.idempotencyKey,
        ...(logo !== undefined && { beforeCommit: (tx?: unknown) => publishPageLogo(tx as Prisma.TransactionClient, owner.tenantId, logo) }),
      });
    } catch (error) {
      if (error instanceof PageLogoGone) return ownerError("logo_unknown", 409);
      throw error;
    }
    if (!result.ok && result.detail === JOURNALS_UNAVAILABLE) return ownerError(JOURNALS_UNAVAILABLE, 503);
    if (!result.ok) return ownerError(result.detail === SLUG_TAKEN ? SLUG_TAKEN : result.reason, STATUS[result.reason]);
    return withRenewedSession(ownerOk({ state: salonForBrowser(result.state), version: result.version, replayed: result.replayed }), request);
  });
}
