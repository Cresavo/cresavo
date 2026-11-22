import type { NextRequest } from "next/server";
import { createOwnerAccount } from "@/lib/owner-accounts";
import { ownerError, ownerOk, ownerRoute, readJson, withSession } from "@/lib/owner-http";
import { openOwnerSession } from "@/lib/owner-session";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

/** Creates an owner account with its salon and signs the owner in. */
export function POST(request: NextRequest) {
  return ownerRoute(request, async () => {
    await checkRateLimit("signup", clientIp(request.headers));
    const result = await createOwnerAccount(await readJson(request));
    if (!result.ok) return ownerError(result.reason, { invalid: 400, email_taken: 409, slug_unavailable: 503 }[result.reason]);
    const session = await openOwnerSession(result.identity);
    if (!session) return ownerError("session_failed", 500);
    return withSession(ownerOk(), session);
  });
}
