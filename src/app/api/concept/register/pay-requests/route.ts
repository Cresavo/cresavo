import { z } from "zod";
import { withRequestLog } from "@/concept/server/logger";
import { issuePayRequest } from "@/concept/register/pay-request";
import { payJson, payRequestBody, payRequestRefusal } from "@/concept/register/pay-request-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The demo register asks for a request its customer can pay on their own phone.
// The body names an amount and the sample business, never a customer or a booking.

const schema = z.object({
  business: z.string().min(1).max(40),
  workspace: z.enum(["demo", "own", "account"]),
  amountMinor: z.number().int().positive(),
  currency: z.string().length(3),
  methods: z.array(z.enum(["card", "swish"])).min(1).max(2),
}).strict();
const ISSUE_REFUSALS = { not_demo: 403, invalid: 400, busy: 503 } as const;

export const POST = withRequestLog("/api/concept/register/pay-requests", async (request: Request) => {
  const refusal = payRequestRefusal(request, "create");
  if (refusal) return refusal;
  const parsed = schema.safeParse(await payRequestBody(request));
  if (!parsed.success) return payJson({ error: "invalid" }, 400);
  const issued = issuePayRequest(parsed.data);
  if (!issued.ok) return payJson({ error: issued.reason }, ISSUE_REFUSALS[issued.reason], issued.reason === "busy" ? { "Retry-After": "60" } : {});
  return payJson({ token: issued.token, expiresAt: issued.request.expiresAt }, 201);
});
