import type { NextRequest } from "next/server";
import { verifyOwnerCredentials } from "@/lib/owner-accounts";
import { ownerError, ownerOk, ownerRoute, readJson, withSession } from "@/lib/owner-http";
import { openOwnerSession, type OwnerCookie } from "@/lib/owner-session";
import { checkLoginAttempt, clientIp } from "@/lib/rate-limit";

export function POST(request: NextRequest) {
  return ownerRoute(request, async () => {
    const input = await readJson(request);
    const session: { cookie?: OwnerCookie } = {};
    const accepted = await checkLoginAttempt(clientIp(request.headers), async () => {
      const identity = await verifyOwnerCredentials(input);
      session.cookie = identity ? (await openOwnerSession(identity)) ?? undefined : undefined;
      return session.cookie !== undefined;
    });
    return accepted && session.cookie ? withSession(ownerOk(), session.cookie) : ownerError("invalid_credentials", 401);
  });
}
