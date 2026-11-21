import type { NextRequest } from "next/server";
import { ownerError, ownerOk, ownerRoute } from "@/lib/owner-http";
import { ownerFromCookie, OWNER_COOKIE } from "@/lib/owner-session";

/** Who is signed in. The tenant id stays on the server. */
export function GET(request: NextRequest) {
  return ownerRoute(request, async () => {
    const owner = await ownerFromCookie(request.cookies.get(OWNER_COOKIE)?.value);
    return owner ? ownerOk({ email: owner.email }) : ownerError("signed_out", 401);
  }, { write: false });
}
