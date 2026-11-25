import { z } from "zod";
import { withRequestLog } from "@/concept/server/logger";
import { payPayRequest, readPayRequest } from "@/concept/register/pay-request";
import { payJson, payRequestBody, payRequestRefusal } from "@/concept/register/pay-request-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ token: string }> };
const schema = z.object({ method: z.enum(["card", "swish"]) }).strict();
const REFUSALS = { already_paid: 409, expired: 410, method_not_allowed: 400 } as const;

// The customer's phone pays the request, once. Simulated: no card, no Swish, no money.
export const POST = withRequestLog("/api/concept/register/pay-requests/[token]/pay", async (request: Request, { params }: Context) => {
  const refusal = payRequestRefusal(request, "pay");
  if (refusal) return refusal;
  const payRequest = readPayRequest((await params).token);
  if (!payRequest) return payJson({ error: "unknown" }, 404);
  const parsed = schema.safeParse(await payRequestBody(request));
  if (!parsed.success) return payJson({ error: "invalid" }, 400);
  const outcome = payPayRequest(payRequest, parsed.data.method);
  if (outcome !== "paid") return payJson({ error: outcome }, REFUSALS[outcome]);
  return payJson({ status: "paid", method: parsed.data.method });
});
