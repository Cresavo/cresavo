import type { NextRequest } from "next/server";
import { ownerError, ownerOk, ownerRoute, readBoundedJson } from "@/lib/owner-http";
import { resetPassword } from "@/lib/owner-password-reset";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

const MAX_BODY_BYTES = 2048;

/** Sets a new password from the e-mailed token and ends every session. The owner signs in again afterwards. */
export function POST(request: NextRequest) {
  return ownerRoute(request, async () => {
    await checkRateLimit("password-reset-submit", clientIp(request.headers));
    const json = await readBoundedJson(request, MAX_BODY_BYTES);
    const result = await resetPassword(json === "too_large" ? null : json);
    return result.ok ? ownerOk() : ownerError(result.reason, 400);
  });
}
