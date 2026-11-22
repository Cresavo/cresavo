import { after, type NextRequest } from "next/server";
import { z } from "zod";
import { ownerEmailSchema } from "@/lib/owner-accounts";
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
    const email = z.object({ email: ownerEmailSchema }).safeParse(input);
    // Per mailbox too, so one address cannot be flooded from many addresses. Any well-formed address counts, known or not.
    if (email.success) await checkRateLimit("password-reset-email", email.data.email);
    after(() => requestPasswordReset(input));
    return ownerOk();
  });
}
