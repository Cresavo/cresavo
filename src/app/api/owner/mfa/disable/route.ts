import type { NextRequest } from "next/server";
import { mfaRoute } from "@/lib/owner-mfa-route";
import { disableMfa } from "@/lib/owner-mfa-setup";

/** `{ password, code }` or `{ password, recoveryCode }`: turns two-step sign-in off and signs every other device out. */
export function POST(request: NextRequest) {
  return mfaRoute(request, (accountId, input) => disableMfa(accountId, input));
}
