import { NextResponse, type NextRequest } from "next/server";
import { ownerOk, ownerRoute, signedInOwner, withoutSession } from "@/lib/owner-http";
import { signOutEverywhere } from "@/lib/owner-session";

/** "Sign out everywhere": ends every session and pending sign-in of the signed-in owner, this one included. */
export function POST(request: NextRequest) {
  return ownerRoute(request, async () => {
    const owner = await signedInOwner(request);
    if (owner instanceof NextResponse) return owner;
    await signOutEverywhere(owner.accountId);
    return withoutSession(ownerOk());
  });
}
