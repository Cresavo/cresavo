import type { NextRequest, NextResponse } from "next/server";
import { ownerError, ownerOk, ownerRoute, readBoundedJson, withSession, withoutSession } from "./owner-http";
import { MFA_FAILURE_STATUS, type MfaFailure } from "./owner-mfa-setup";
import { ownerFromCookie, OWNER_COOKIE, type OwnerCookie } from "./owner-session";
import { checkLoginAttempt, clientIp } from "./rate-limit";

const MAX_BODY_BYTES = 1024;

type Outcome = { ok: false; reason: MfaFailure } | { ok: true; cookie?: OwnerCookie | null; [field: string]: unknown };

/**
 * The shared shape of /api/owner/mfa/*: a signed-in owner (an enrolment-only session too), a small JSON body,
 * and the per-address sign-in limit around the password check, refunded on success. A result that re-issued
 * the session sets the new cookie, or clears it when the account changed meanwhile.
 */
export function mfaRoute(request: NextRequest, run: (accountId: string, input: unknown) => Promise<Outcome>) {
  return ownerRoute(request, async (): Promise<NextResponse> => {
    const owner = await ownerFromCookie(request.cookies.get(OWNER_COOKIE)?.value);
    if (!owner) return ownerError("signed_out", 401);
    const json = await readBoundedJson(request, MAX_BODY_BYTES);
    if (json === "too_large") return ownerError("too_large", 413);
    const results: Outcome[] = [];
    await checkLoginAttempt(clientIp(request.headers), async () => {
      const result = await run(owner.accountId, json);
      results.push(result);
      return result.ok;
    });
    const [outcome] = results;
    if (!outcome?.ok) return ownerError(outcome?.reason ?? "invalid", MFA_FAILURE_STATUS[outcome?.reason ?? "invalid"]);
    const { ok, cookie, ...body } = outcome;
    if (cookie === undefined) return ownerOk({ ok, ...body });
    return cookie ? withSession(ownerOk({ ok, ...body }), cookie) : withoutSession(ownerOk({ ok, signedOut: true, ...body }));
  });
}
