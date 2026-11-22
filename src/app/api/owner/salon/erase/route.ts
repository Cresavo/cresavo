import type { NextRequest } from "next/server";
import { z } from "zod";
import { ownerError, ownerOk, ownerRoute, readBoundedJson } from "@/lib/owner-http";
import { ownerFromCookie, OWNER_COOKIE } from "@/lib/owner-session";
import { id } from "@/lib/owner-actions/primitives";
import { ownerStore } from "@/lib/owner-store";

const bodySchema = z.object({ customerId: id }).strict();

const MAX_BODY_BYTES = 1024;

/**
 * Erases one customer of the signed-in owner's salon for good (GDPR art. 17):
 * the customer's record and everything of theirs in the document, and their
 * data in the audit log, the message outbox and the stored replay results
 * (`PostgresStudioStore.eraseSubject`). The salon always comes from the session.
 * `customer/erase` is refused as a plain action on purpose: it only runs here,
 * where the tables are redacted in the same transaction.
 */
export function POST(request: NextRequest) {
  return ownerRoute(request, async () => {
    const owner = await ownerFromCookie(request.cookies.get(OWNER_COOKIE)?.value);
    if (!owner) return ownerError("signed_out", 401);
    const json = await readBoundedJson(request, MAX_BODY_BYTES);
    if (json === "too_large") return ownerError("too_large", 413);
    const body = bodySchema.safeParse(json);
    if (!body.success) return ownerError("invalid", 400);
    const store = ownerStore();
    const result = await store.eraseSubject(owner.tenantId, body.data.customerId, { actor: "owner", source: "button" });
    if (!result.ok) return ownerError(result.reason, result.reason === "conflict" ? 409 : 404);
    const snapshot = await store.load(owner.tenantId);
    if (!snapshot) return ownerError("not_found", 404);
    return ownerOk({ state: snapshot.state, version: snapshot.version, pendingPayments: result.pendingPayments, inFlightMessages: result.inFlightMessages });
  });
}
