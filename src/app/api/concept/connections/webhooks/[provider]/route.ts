import { DEMO_BUSINESS } from "@/concept/ai/demo-store";
import { handleWebhook } from "@/concept/connections/server/webhooks";
import { withRequestLog } from "@/concept/server/logger";
import { publicReadonlyResponse } from "@/lib/public-readonly";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Provider webhooks (Stripe, Twilio, 46elks, Resend, Postmark). The public
// demo never verifies anything: it is read-only and every adapter is simulated.
export const POST = withRequestLog("/api/concept/connections/webhooks/[provider]", async (request: Request, context: { params: Promise<{ provider: string }> }) => {
  const blocked = publicReadonlyResponse(request);
  if (blocked) return blocked;
  const { provider } = await context.params;
  return handleWebhook(request, provider, DEMO_BUSINESS);
});
