import type { NextRequest } from "next/server";
import { verifyOwnerCredentials } from "@/lib/owner-accounts";
import { ownerError, ownerOk, ownerRoute, readJson, withSession } from "@/lib/owner-http";
import { openOwnerSession } from "@/lib/owner-session";
import { checkLoginAttempt, clientIp } from "@/lib/rate-limit";

export function POST(request: NextRequest) {
  return ownerRoute(request, async () => {
    const input = await readJson(request);
    const session: { value?: string } = {};
    const accepted = await checkLoginAttempt(clientIp(request.headers), async () => {
      const identity = await verifyOwnerCredentials(input);
      session.value = identity ? (await openOwnerSession(identity))?.value : undefined;
      return session.value !== undefined;
    });
    return accepted && session.value ? withSession(ownerOk(), session.value) : ownerError("invalid_credentials", 401);
  });
}
