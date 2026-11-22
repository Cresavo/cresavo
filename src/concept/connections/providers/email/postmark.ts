// Postmark email over plain fetch.
// Sources (checked 2026-11):
// - Send: https://postmarkapp.com/developer/api/email-api
// - Errors (ErrorCode, Message; X-PM-ApiErrorCode): https://postmarkapp.com/developer/api/overview
// - Metadata: https://postmarkapp.com/support/article/1125-custom-metadata-faq
// - No idempotency keys: https://postmarkapp.com/support/article/what-is-an-idempotency-key
// - Webhooks (no HMAC; Basic auth over HTTPS): https://postmarkapp.com/developer/webhooks/webhooks-overview
// - Pricing: https://www.postmarkapp.com/pricing (USD, verify)
// verify: Postmark documents no numeric rate limit; 429 is mapped to rate_limited.
import { connectionError, fail, isEmail, ok, type DeliveryStatus } from "../../core";
import type { EmailPort } from "../../ports/email";
import { safeEqual } from "../../server/crypto";
import { basicAuth, field, request, text, type Fetcher } from "../../server/http";
import type { ProviderDefinition } from "../definition";

const PROVIDER = "postmark";
const RECORDS: Record<string, DeliveryStatus> = { Delivery: "delivered", Bounce: "failed", SpamComplaint: "delivered" };

// Postmark answers 422 for every API error; ErrorCode says which. 300 invalid email, 406 inactive recipient, 10 bad token.
const codeOf = (data: unknown) => {
  const code = field(data, "ErrorCode");
  if (code === 10) return { code: "unauthorized" as const, providerCode: code };
  if (code === 406) return { code: "rejected" as const, providerCode: code };
  return { providerCode: code };
};

export function postmarkEmail(options: { serverToken: string; webhookUser?: string; webhookPassword?: string; fetch: Fetcher }): EmailPort {
  const context = { port: "email" as const, provider: PROVIDER, fetch: options.fetch, secrets: [options.serverToken, options.webhookPassword ?? ""] };
  return {
    info: definition.info,
    async send(message) {
      if (!(message.to.length > 0 && message.to.length <= 50 && message.to.every(isEmail) && message.subject.trim() && message.text.trim())) return fail(connectionError("email", PROVIDER, "invalid_input"));
      const tags = Object.entries(message.tags ?? {});
      const result = await request(context, "https://api.postmarkapp.com/email", {
        method: "POST",
        headers: { "X-Postmark-Server-Token": options.serverToken, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          From: message.from,
          To: message.to.join(","),
          Subject: message.subject,
          TextBody: message.text,
          ...(message.html ? { HtmlBody: message.html } : {}),
          ...(message.replyTo ? { ReplyTo: message.replyTo } : {}),
          ...(tags.length ? { Tag: tags[0][1], Metadata: Object.fromEntries(tags) } : {}),
          ...(message.tracking === false ? { TrackLinks: "None", TrackOpens: false } : {}),
          MessageStream: "outbound",
        }),
      }, codeOf, { idempotent: false });
      if (!result.ok) return fail(result.error);
      const id = text(field(result.data, "MessageID"));
      const code = field(result.data, "ErrorCode");
      if (id && code === 0) return ok({ id, to: message.to }, "queued", null, id);
      // A 200 without a readable receipt may still have queued the message: uncertain, not rejected. An error code is a refusal.
      return fail(connectionError("email", PROVIDER, code === undefined || code === 0 ? "provider_unavailable" : "unknown"));
    },
    async verifyWebhook(webhook) {
      const expected = options.webhookUser && options.webhookPassword && options.webhookPassword.length >= 16 ? basicAuth(options.webhookUser, options.webhookPassword) : undefined;
      const given = webhook.headers.authorization;
      if (!expected || !given || !safeEqual(given, expected)) return fail(connectionError("email", PROVIDER, "invalid_signature"));
      let event: unknown;
      try {
        event = JSON.parse(webhook.rawBody);
      } catch {
        return fail(connectionError("email", PROVIDER, "invalid_input"));
      }
      const providerId = text(field(event, "MessageID"));
      if (!providerId) return fail(connectionError("email", PROVIDER, "invalid_input"));
      const status = RECORDS[String(field(event, "RecordType"))] ?? "sent";
      return ok({ providerId, status }, status);
    },
  };
}

export const definition: ProviderDefinition<"email"> = {
  info: { port: "email", provider: PROVIDER, kind: "live", capabilities: ["send", "html", "tags", "event-webhook"], secrets: ["POSTMARK_SERVER_TOKEN", "POSTMARK_WEBHOOK_PASSWORD"] },
  secrets: ["POSTMARK_SERVER_TOKEN"],
  optionalSecrets: ["POSTMARK_WEBHOOK_PASSWORD"],
  settings: ["POSTMARK_WEBHOOK_USER"],
  create: ({ secrets, settings, fetch }) => postmarkEmail({ serverToken: secrets.POSTMARK_SERVER_TOKEN, webhookPassword: secrets.POSTMARK_WEBHOOK_PASSWORD, webhookUser: settings.POSTMARK_WEBHOOK_USER, fetch }),
};
