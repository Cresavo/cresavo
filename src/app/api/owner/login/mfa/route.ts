import type { NextRequest } from "next/server";
import { ownerError, ownerOk, ownerRoute, readBoundedJson, withoutPendingSecondStep, withSession } from "@/lib/owner-http";
import { completeSecondStep, type SecondStepResult } from "@/lib/owner-mfa";
import { SECOND_STEP_COOKIE } from "@/lib/owner-mfa-pending";
import type { OwnerCookie } from "@/lib/owner-session";
import { checkLoginAttempt, clientIp } from "@/lib/rate-limit";

const MAX_BODY_BYTES = 1024;

type Refusal = Extract<SecondStepResult, { ok: false }>["reason"];

/**
 * The second step of a sign-in: `{ code }` from the authenticator app or `{ recoveryCode }`, with the pending
 * cookie a correct password set. Opens the session exactly as a sign-in without two-step sign-in does. Each try
 * counts toward the same per-address limit as a password, and a wrong code toward the account's lock-out.
 */
export function POST(request: NextRequest) {
  return ownerRoute(request, async () => {
    const json = await readBoundedJson(request, MAX_BODY_BYTES);
    const pending = request.cookies.get(SECOND_STEP_COOKIE)?.value;
    const outcome: { cookie?: OwnerCookie; reason?: Refusal } = {};
    const accepted = await checkLoginAttempt(clientIp(request.headers), async () => {
      // Spends the code, consumes the challenge and opens the session in one transaction.
      const result = await completeSecondStep(pending, json === "too_large" ? null : json);
      if (result.ok) outcome.cookie = result.cookie;
      else outcome.reason = result.reason;
      return result.ok;
    });
    if (accepted && outcome.cookie) return withoutPendingSecondStep(withSession(ownerOk(), outcome.cookie));
    if (outcome.reason === "not_configured") return ownerError("not_configured", 503);
    if (outcome.reason === "expired") return withoutPendingSecondStep(ownerError("mfa_expired", 401));
    return ownerError("invalid_code", 401);
  });
}
