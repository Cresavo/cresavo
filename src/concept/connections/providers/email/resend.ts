// Resend email over plain fetch.
// Sources (checked 2026-11):
// - Send: https://resend.com/docs/api-reference/emails/send-email, spec: https://raw.githubusercontent.com/resend/resend-openapi/main/resend.yaml
// - Errors: https://resend.com/docs/api-reference/errors
// - Rate limit (10 requests/s per team, retry-after): https://resend.com/docs/api-reference/rate-limit
// - Idempotency-Key (1-256 chars, 24 h): https://resend.com/docs/dashboard/emails/idempotency-keys
// - Webhooks (Svix): https://resend.com/docs/webhooks/verify-webhooks-requests
// - Pricing: https://resend.com/pricing (USD, verify)
import { connectionError, fail, isEmail, ok, type DeliveryStatus } from "../../core";
import type { EmailPort } from "../../ports/email";
import { field, request, text, type Fetcher } from "../../server/http";
import { verifySvix } from "../../server/svix";
import type { ProviderDefinition } from "../definition";

const PROVIDER = "resend";
const EVENTS: Record<string, DeliveryStatus> = { "email.sent": "sent", "email.delivered": "delivered", "email.bounced": "failed", "email.failed": "failed", "email.delivery_delayed": "queued" };
const TAG = /^[A-Za-z0-9_-]{1,256}$/;

const codeOf = (data: unknown, status: number) => {
  const name = field(data, "name");
  if (status === 429 && (name === "daily_quota_exceeded" || name === "monthly_quota_exceeded")) return { code: "rejected" as const, providerCode: name };
  return { providerCode: name };
};

export function resendEmail(options: { apiKey: string; webhookSecret?: string; fetch: Fetcher }): EmailPort {
  const context = { port: "email" as const, provider: PROVIDER, fetch: options.fetch, secrets: [options.apiKey, options.webhookSecret ?? ""] };
  return {
    info: definition.info,
    async send(message) {
      const valid = message.to.length > 0 && message.to.length <= 50 && message.to.every(isEmail) && message.subject.trim() && message.text.trim() &&
        (!message.idempotencyKey || message.idempotencyKey.length <= 256) && Object.entries(message.tags ?? {}).every(([k, v]) => TAG.test(k) && TAG.test(v));
      if (!valid) return fail(connectionError("email", PROVIDER, "invalid_input"));
      const result = await request(context, "https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          "Content-Type": "application/json",
          ...(message.idempotencyKey ? { "Idempotency-Key": message.idempotencyKey } : {}),
        },
        body: JSON.stringify({
          from: message.from,
          to: message.to,
          subject: message.subject,
          text: message.text,
          ...(message.html ? { html: message.html } : {}),
          ...(message.replyTo ? { reply_to: message.replyTo } : {}),
          ...(message.tags ? { tags: Object.entries(message.tags).map(([name, value]) => ({ name, value })) } : {}),
        }),
      }, codeOf);
      if (!result.ok) return fail(result.error);
      const id = text(field(result.data, "id"));
      return id ? ok({ id, to: message.to }, "queued", null, id) : fail(connectionError("email", PROVIDER, "unknown"));
    },
    async verifyWebhook(webhook) {
      const now = webhook.nowSeconds ?? Math.floor(Date.now() / 1000);
      if (!options.webhookSecret || !verifySvix(options.webhookSecret, webhook.headers, webhook.rawBody, now)) return fail(connectionError("email", PROVIDER, "invalid_signature"));
      let event: unknown;
      try {
        event = JSON.parse(webhook.rawBody);
      } catch {
        return fail(connectionError("email", PROVIDER, "invalid_input"));
      }
      const providerId = text(field(event, "data", "email_id"));
      if (!providerId) return fail(connectionError("email", PROVIDER, "invalid_input"));
      const status = EVENTS[String(field(event, "type"))] ?? "sent";
      return ok({ providerId, status }, status);
    },
  };
}

export const definition: ProviderDefinition<"email"> = {
  info: { port: "email", provider: PROVIDER, kind: "live", capabilities: ["send", "html", "tags", "idempotency", "event-webhook"], secrets: ["RESEND_API_KEY", "RESEND_WEBHOOK_SECRET"] },
  secrets: ["RESEND_API_KEY"],
  optionalSecrets: ["RESEND_WEBHOOK_SECRET"],
  settings: [],
  create: ({ secrets, fetch }) => resendEmail({ apiKey: secrets.RESEND_API_KEY, webhookSecret: secrets.RESEND_WEBHOOK_SECRET, fetch }),
};
