// Twilio Programmable Messaging over plain fetch.
// Sources (checked 2026-11):
// - Create message: https://www.twilio.com/docs/messaging/api/message-resource#create-a-message-resource
// - OpenAPI spec: https://raw.githubusercontent.com/twilio/twilio-oai/main/spec/yaml/twilio_api_v2010.yaml
// - Auth: https://www.twilio.com/docs/usage/requests-to-twilio
// - Errors: https://www.twilio.com/docs/usage/twilios-response#exceptions, 429/20429: https://www.twilio.com/docs/api/errors/20429
// - Status callbacks: https://www.twilio.com/docs/messaging/guides/track-outbound-message-status
// - Signature: https://www.twilio.com/docs/usage/security#explore-the-algorithm-yourself
// - Prices: https://www.twilio.com/en-us/sms/pricing/se (USD 0.0646/segment, verify), https://www.twilio.com/en-us/sms/pricing/us
// Twilio has no idempotency key for message creation (verify): callers must not retry a send that may have gone out.
import { connectionError, fail, isE164, moneyFromMajor, ok, type DeliveryStatus } from "../../core";
import type { WebhookRequest } from "../../ports/webhook";
import { smsSegments, type SmsPort } from "../../ports/sms";
import { hmac, safeEqual } from "../../server/crypto";
import { basicAuth, field, form, request, text, type Fetcher } from "../../server/http";
import type { ProviderDefinition } from "../definition";

const PROVIDER = "twilio";
const SID = /^AC[0-9a-f]{32}$/;
const STATUS: Record<string, DeliveryStatus> = { accepted: "queued", scheduled: "queued", queued: "queued", sending: "queued", sent: "sent", delivered: "delivered", undelivered: "failed", failed: "failed", canceled: "failed" };

/** Twilio's request signature: HMAC-SHA1 over the URL plus every POST field name and value, sorted by name, base64. */
export function twilioSignature(authToken: string, url: string, params: URLSearchParams): string {
  const names = [...new Set(params.keys())].sort();
  let data = url;
  for (const name of names) for (const value of [...params.getAll(name)].sort()) data += name + value;
  return hmac("sha1", authToken, data, "base64");
}

const codeOf = (data: unknown) => ({ providerCode: field(data, "code") });

export function twilioSms(options: { accountSid: string; authToken: string; from?: string; messagingServiceSid?: string; fetch: Fetcher }): SmsPort {
  const context = { port: "sms" as const, provider: PROVIDER, fetch: options.fetch, secrets: [options.authToken] };
  return {
    info: definition.info,
    async send(message) {
      if (!SID.test(options.accountSid)) return fail(connectionError("sms", PROVIDER, "not_configured"));
      if (!isE164(message.to) || !message.body.trim() || message.body.length > 1600) return fail(connectionError("sms", PROVIDER, "invalid_input"));
      const sender = message.from ?? options.from;
      if (!sender && !options.messagingServiceSid) return fail(connectionError("sms", PROVIDER, "not_configured"));
      const result = await request(context, `https://api.twilio.com/2010-04-01/Accounts/${options.accountSid}/Messages.json`, {
        method: "POST",
        headers: { Authorization: basicAuth(options.accountSid, options.authToken), "Content-Type": "application/x-www-form-urlencoded" },
        body: form({ To: message.to, Body: message.body, From: options.messagingServiceSid && !message.from ? undefined : sender, MessagingServiceSid: message.from ? undefined : options.messagingServiceSid, StatusCallback: message.statusCallbackUrl }),
      }, codeOf);
      if (!result.ok) return fail(result.error);
      const sid = text(field(result.data, "sid"));
      if (!sid) return fail(connectionError("sms", PROVIDER, "unknown"));
      const status = STATUS[String(field(result.data, "status"))] ?? "queued";
      return ok({ id: sid, to: message.to, segments: Number(field(result.data, "num_segments")) || smsSegments(message.body) }, status, moneyFromMajor(field(result.data, "price"), field(result.data, "price_unit")), sid);
    },
    async verifyWebhook(webhook: WebhookRequest) {
      const signature = webhook.headers["x-twilio-signature"];
      const params = new URLSearchParams(webhook.rawBody);
      if (!signature || webhook.method !== "POST" || !safeEqual(twilioSignature(options.authToken, webhook.url, params), signature)) {
        return fail(connectionError("sms", PROVIDER, "invalid_signature"));
      }
      const providerId = params.get("MessageSid");
      if (!providerId) return fail(connectionError("sms", PROVIDER, "invalid_input"));
      return ok({ providerId, status: STATUS[params.get("MessageStatus") ?? ""] ?? "queued" }, STATUS[params.get("MessageStatus") ?? ""] ?? "queued");
    },
  };
}

export const definition: ProviderDefinition<"sms"> = {
  info: { port: "sms", provider: PROVIDER, kind: "live", capabilities: ["send", "alphanumeric-sender", "delivery-webhook"], secrets: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"] },
  secrets: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"],
  settings: ["TWILIO_FROM", "TWILIO_MESSAGING_SERVICE_SID"],
  create: ({ secrets, settings, fetch }) =>
    twilioSms({ accountSid: secrets.TWILIO_ACCOUNT_SID, authToken: secrets.TWILIO_AUTH_TOKEN, from: settings.TWILIO_FROM, messagingServiceSid: settings.TWILIO_MESSAGING_SERVICE_SID, fetch }),
};
