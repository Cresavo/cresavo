import { after, type NextRequest } from "next/server";
import { ownerOk, ownerRoute, readBoundedJson } from "@/lib/owner-http";
import { requestPasswordReset } from "@/lib/owner-password-reset";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

const MAX_BODY_BYTES = 1024;

/**
 * Asks for a reset e-mail. The answer is the same whether or not the address has an account, and it comes
 * before the lookup and the send, so it takes the same time either way.
 */
export function POST(request: NextRequest) {
  return ownerRoute(request, async () => {
    await checkRateLimit("password-reset", clientIp(request.headers));
    const input = await readBoundedJson(request, MAX_BODY_BYTES);
    // The mailbox quota is charged by requestPasswordReset, only for a valid address that has an account and gets a mail.
    after(() => requestPasswordReset(input));
    return ownerOk();
  });
}
