import type { NextRequest } from "next/server";
import { mfaRoute } from "@/lib/owner-mfa-route";
import { enableMfa } from "@/lib/owner-mfa-setup";

/** `{ password, code }`: turns two-step sign-in on, returns the recovery codes once and signs every other device out. */
export function POST(request: NextRequest) {
  return mfaRoute(request, (accountId, input) => enableMfa(accountId, input));
}
