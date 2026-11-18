// 46elks SMS (regional adapter, Nordics) over plain fetch.
// Sources (checked 2026-11):
// - Send SMS: https://46elks.com/docs/send-sms
// - API overview and auth: https://46elks.com/docs/overview
// - Spec: https://raw.githubusercontent.com/46elks/46elks-getting-started/master/code-examples/Swagger/46elksAPI.yaml
// - Delivery reports: https://46elks.com/docs/sms-delivery-reports, callback IPs: https://46elks.com/docs/ip-addresses
// - Price: https://46elks.se/pricing/se-sek (SEK 0.52 per segment excl. VAT, verify)
// Errors are plain text, so only the HTTP status is mapped. Throughput 100 SMS/minute/account (queued beyond).
// verify: 46elks does not sign delivery reports. We require a shared token in the callback URL
// (?token=...) and recommend allowlisting their callback IPs at the proxy. No idempotency key (verify).
import { connectionError, fail, isE164, ok, type DeliveryStatus } from "../../core";
import { smsSegments, type SmsPort } from "../../ports/sms";
import { safeEqual } from "../../server/crypto";
import { basicAuth, field, form, request, text, type Fetcher } from "../../server/http";
import type { ProviderDefinition } from "../definition";

const PROVIDER = "46elks";
const STATUS: Record<string, DeliveryStatus> = { created: "queued", sent: "sent", delivered: "delivered", failed: "failed" };

export function elksSms(options: { username: string; password: string; from?: string; currency?: string; webhookToken?: string; fetch: Fetcher }): SmsPort {
  const context = { port: "sms" as const, provider: PROVIDER, fetch: options.fetch, secrets: [options.password, options.webhookToken ?? ""] };
  const currency = /^[A-Z]{3}$/.test(options.currency ?? "") ? options.currency! : "SEK";
  return {
    info: definition.info,
    async send(message) {
      const from = message.from ?? options.from;
      if (!from) return fail(connectionError("sms", PROVIDER, "not_configured"));
      if (!isE164(message.to) || !message.body.trim() || message.body.length > 1600) return fail(connectionError("sms", PROVIDER, "invalid_input"));
      const result = await request(context, "https://api.46elks.com/a1/sms", {
        method: "POST",
        headers: { Authorization: basicAuth(options.username, options.password), "Content-Type": "application/x-www-form-urlencoded" },
        body: form({ to: message.to, from, message: message.body, whendelivered: message.statusCallbackUrl }),
      });
      if (!result.ok) return fail(result.error);
      const id = text(field(result.data, "id"));
      if (!id) return fail(connectionError("sms", PROVIDER, "unknown"));
      const raw = field(result.data, "cost");
      // 46elks reports cost in 1/10,000 of the account currency.
      const cost = typeof raw === "number" && raw >= 0 ? { amountMinor: Math.ceil(raw / 100), currency } : null;
      return ok({ id, to: message.to, segments: Number(field(result.data, "parts")) || smsSegments(message.body) }, STATUS[String(field(result.data, "status"))] ?? "queued", cost, id);
    },
    async verifyWebhook(webhook) {
      let token: string | null = null;
      try {
        token = new URL(webhook.url).searchParams.get("token");
      } catch {
        token = null;
      }
      if (!options.webhookToken || options.webhookToken.length < 16 || !token || !safeEqual(token, options.webhookToken)) return fail(connectionError("sms", PROVIDER, "invalid_signature"));
      const params = new URLSearchParams(webhook.rawBody);
      const providerId = params.get("id");
      if (!providerId) return fail(connectionError("sms", PROVIDER, "invalid_input"));
      const status = STATUS[params.get("status") ?? ""] ?? "queued";
      return ok({ providerId, status }, status);
    },
  };
}

export const definition: ProviderDefinition<"sms"> = {
  info: { port: "sms", provider: PROVIDER, kind: "live", region: "Nordics", capabilities: ["send", "alphanumeric-sender", "delivery-webhook"], secrets: ["ELKS_API_USERNAME", "ELKS_API_PASSWORD", "ELKS_WEBHOOK_TOKEN"] },
  secrets: ["ELKS_API_USERNAME", "ELKS_API_PASSWORD"],
  optionalSecrets: ["ELKS_WEBHOOK_TOKEN"],
  settings: ["ELKS_FROM", "ELKS_CURRENCY"],
  create: ({ secrets, settings, fetch }) =>
    elksSms({ username: secrets.ELKS_API_USERNAME, password: secrets.ELKS_API_PASSWORD, webhookToken: secrets.ELKS_WEBHOOK_TOKEN, from: settings.ELKS_FROM, currency: settings.ELKS_CURRENCY, fetch }),
};
