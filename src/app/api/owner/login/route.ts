import type { NextRequest } from "next/server";
import { verifyOwnerCredentials } from "@/lib/owner-accounts";
import { ownerError, ownerOk, ownerRoute, readBoundedJson, withPendingSecondStep, withSession } from "@/lib/owner-http";
import { LOGIN_MAX_BODY_BYTES } from "@/lib/bounded-json";
import { startSecondStep } from "@/lib/owner-mfa";
import { mfaKey } from "@/lib/owner-mfa-crypto";
import { openOwnerSession, type OwnerCookie } from "@/lib/owner-session";
import { checkLoginAttempt, clientIp } from "@/lib/rate-limit";

/**
 * Signs an owner in with email and password. For an account with two-step sign-in a correct password opens no
 * session: it answers `{ next: "mfa" }` with a short-lived pending cookie for POST /api/owner/login/mfa, or 503
 * when OWNER_MFA_KEY is not configured, so the second step is never skipped.
 */
export function POST(request: NextRequest) {
  return ownerRoute(request, async () => {
    let tooLarge = false;
    const outcome: { cookie?: OwnerCookie; pending?: string; notConfigured?: boolean } = {};
    const accepted = await checkLoginAttempt(clientIp(request.headers), async () => {
      const input = await readBoundedJson(request, LOGIN_MAX_BODY_BYTES);
      if (input === "too_large") { tooLarge = true; return false; }
      const verified = await verifyOwnerCredentials(input);
      if (verified?.next === "mfa") {
        if (mfaKey()) outcome.pending = await startSecondStep(verified.identity);
        else outcome.notConfigured = true;
        return true;
      }
      outcome.cookie = verified ? (await openOwnerSession(verified.identity)) ?? undefined : undefined;
      return outcome.cookie !== undefined;
    });
    if (tooLarge) return ownerError("too_large", 413);
    if (accepted && outcome.notConfigured) return ownerError("not_configured", 503);
    if (accepted && outcome.pending) return withPendingSecondStep(ownerOk({ next: "mfa" }), outcome.pending);
    if (accepted && outcome.cookie) return withSession(ownerOk(), outcome.cookie);
    return ownerError("invalid_credentials", 401);
  });
}
