import type { NextRequest } from "next/server";
import { ownerOk, ownerRoute, withoutSession } from "@/lib/owner-http";
import { closeOwnerSession, OWNER_COOKIE } from "@/lib/owner-session";

export function POST(request: NextRequest) {
  return ownerRoute(request, async () => {
    await closeOwnerSession(request.cookies.get(OWNER_COOKIE)?.value);
    return withoutSession(ownerOk());
  });
}
