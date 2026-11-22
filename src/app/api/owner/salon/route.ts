import type { NextRequest } from "next/server";
import { ownerError, ownerOk, ownerRoute, withRenewedSession } from "@/lib/owner-http";
import { ownerFromCookie, OWNER_COOKIE } from "@/lib/owner-session";
import { ownerStore } from "@/lib/owner-store";

/** The signed-in owner's salon and its version. */
export function GET(request: NextRequest) {
  return ownerRoute(request, async () => {
    const owner = await ownerFromCookie(request.cookies.get(OWNER_COOKIE)?.value);
    if (!owner) return ownerError("signed_out", 401);
    const snapshot = await ownerStore().load(owner.tenantId);
    return snapshot ? withRenewedSession(ownerOk({ state: snapshot.state, version: snapshot.version }), request) : ownerError("not_found", 404);
  }, { write: false });
}
