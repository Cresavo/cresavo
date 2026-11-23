import type { NextRequest } from "next/server";
import { mfaRoute } from "@/lib/owner-mfa-route";
import { beginMfaSetup } from "@/lib/owner-mfa-setup";

/** `{ password }`: a new secret for the authenticator app, as `{ otpauthUri, secret }`, to confirm with POST /api/owner/mfa/enable within ten minutes. */
export function POST(request: NextRequest) {
  return mfaRoute(request, (accountId, input) => beginMfaSetup(accountId, input));
}
