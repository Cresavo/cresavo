import type { NextRequest } from "next/server";
import { ownerError, ownerOk, ownerRoute, withRenewedSession } from "@/lib/owner-http";
import { ownerFromCookie, OWNER_COOKIE } from "@/lib/owner-session";

/** Who is signed in, and whether two-step sign-in is on. The tenant id and every secret stay on the server. */
export function GET(request: NextRequest) {
  return ownerRoute(request, async () => {
    const owner = await ownerFromCookie(request.cookies.get(OWNER_COOKIE)?.value);
    return owner ? withRenewedSession(ownerOk({ email: owner.email, mfaEnabled: owner.mfaEnabled }), request) : ownerError("signed_out", 401);
  }, { write: false });
}
