import type { NextRequest } from "next/server";
import { ownerError, ownerOk, ownerRoute, withoutSession } from "@/lib/owner-http";
import { closeAllOwnerSessions, ownerFromCookie, OWNER_COOKIE } from "@/lib/owner-session";

/** "Sign out everywhere": ends every session of the signed-in owner, this one included. */
export function POST(request: NextRequest) {
  return ownerRoute(request, async () => {
    const owner = await ownerFromCookie(request.cookies.get(OWNER_COOKIE)?.value);
    if (!owner) return ownerError("signed_out", 401);
    await closeAllOwnerSessions(owner.accountId);
    return withoutSession(ownerOk());
  });
}
