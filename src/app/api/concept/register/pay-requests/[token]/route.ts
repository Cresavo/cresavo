import { withRequestLog } from "@/concept/server/logger";
import { payRequestStatus, readPayRequest } from "@/concept/register/pay-request";
import { payJson, payRequestRefusal } from "@/concept/register/pay-request-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ token: string }> };

// The register polls this until its request is paid or has expired.
export const GET = withRequestLog("/api/concept/register/pay-requests/[token]", async (request: Request, { params }: Context) => {
  const refusal = payRequestRefusal(request, "status");
  if (refusal) return refusal;
  const payRequest = readPayRequest((await params).token);
  if (!payRequest) return payJson({ error: "unknown" }, 404);
  return payJson(payRequestStatus(payRequest));
});
