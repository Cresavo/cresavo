import { NextResponse, type NextRequest } from "next/server";
import { ownerOk, ownerRoute, signedInOwner, withoutSession } from "@/lib/owner-http";
import { closeAllOwnerSessions } from "@/lib/owner-session";

/** "Sign out everywhere": ends every session of the signed-in owner, this one included. */
export function POST(request: NextRequest) {
  return ownerRoute(request, async () => {
    const owner = await signedInOwner(request);
    if (owner instanceof NextResponse) return owner;
    await closeAllOwnerSessions(owner.accountId);
    return withoutSession(ownerOk());
  });
}
