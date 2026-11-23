import type { NextRequest } from "next/server";
import { mfaRoute } from "@/lib/owner-mfa-route";
import { regenerateRecoveryCodes } from "@/lib/owner-mfa-setup";

/** `{ password, code }`: new recovery codes, returned once. The old ones stop working. */
export function POST(request: NextRequest) {
  return mfaRoute(request, (accountId, input) => regenerateRecoveryCodes(accountId, input));
}
