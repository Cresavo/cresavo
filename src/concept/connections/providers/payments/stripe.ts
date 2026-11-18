// Stripe Checkout Sessions, Payment Links, refunds and webhooks over plain fetch.
// Sources (checked 2026-11):
// - Auth and form encoding: https://docs.stripe.com/api/authentication
// - Checkout Session: https://docs.stripe.com/api/checkout/sessions/create
// - allowed_payment_method_types replaces payment_method_types from 2026-09-30.endive:
//   https://docs.stripe.com/changelog/endive/2026-09-30/remove-payment-method-types-checkout-sessions
// - Payment Links: https://docs.stripe.com/api/payment-link/create
// - Refunds: https://docs.stripe.com/api/refunds/create
// - Idempotency (Idempotency-Key, <= 255 chars, 24 h): https://docs.stripe.com/api/idempotent_requests
// - Errors (error.type/code/message; 402 card_error): https://docs.stripe.com/api/errors
// - Rate limits (100/s live, 25/s sandbox): https://docs.stripe.com/rate-limits
// - Webhook signatures: https://docs.stripe.com/webhooks#verify-manually, https://github.com/stripe/stripe-node/blob/master/src/Webhooks.ts
// - Swish (SEK only, 3-150,000 SEK, payment mode): https://docs.stripe.com/payments/swish
// - Klarna: https://docs.stripe.com/payments/klarna
// - Pricing (Sweden): https://stripe.com/en-se/pricing (verify)
import { connectionError, fail, isMoney, ok, type Money } from "../../core";
import type { CheckoutInput, PaymentEvent, PaymentsPort } from "../../ports/payments";
import { hmac, safeEqual } from "../../server/crypto";
import { field, request, text, type Fetcher } from "../../server/http";
import type { ProviderDefinition } from "../definition";

const PROVIDER = "stripe";
// verify: pinned version from the API reference in 2026-11; bump deliberately, webhook endpoint versions are set separately.
export const STRIPE_VERSION = "2026-10-28.endive";
export const STRIPE_TOLERANCE_SECONDS = 300;
const SECRET_KEY = /^(sk|rk)_(test|live)_[A-Za-z0-9]{10,}$/;
const METHODS = new Set(["card", "klarna", "swish", "mobilepay", "ideal", "bancontact"]);

const codeOf = (data: unknown) => {
  const type = field(data, "error", "type");
  const code = field(data, "error", "code");
  if (type === "card_error") return { code: "rejected" as const, providerCode: code ?? type };
  if (type === "idempotency_error") return { code: "conflict" as const, providerCode: type };
  return { providerCode: code ?? type };
};

/** Parses `t=...,v1=...,v1=...` and checks any v1 signature over `${t}.${rawBody}` with the whole whsec_ string as key. */
export function verifyStripeSignature(secret: string, header: string, rawBody: string, nowSeconds: number, tolerance = STRIPE_TOLERANCE_SECONDS): boolean {
  if (!secret.startsWith("whsec_")) return false;
  const parts = header.split(",").map((part) => part.split("=", 2) as [string, string | undefined]);
  const timestamp = parts.find(([key]) => key === "t")?.[1];
  const signatures = parts.filter(([key, value]) => key === "v1" && value).map(([, value]) => value as string);
  if (!timestamp || !/^\d{1,12}$/.test(timestamp) || signatures.length === 0) return false;
  if (Math.abs(nowSeconds - Number(timestamp)) > tolerance) return false;
  const expected = hmac("sha256", secret, `${timestamp}.${rawBody}`, "hex");
  return signatures.some((signature) => safeEqual(signature, expected));
}

function lineItem(fields: URLSearchParams, input: { amount: Money; description: string }) {
  fields.set("line_items[0][quantity]", "1");
  fields.set("line_items[0][price_data][currency]", input.amount.currency.toLowerCase());
  fields.set("line_items[0][price_data][unit_amount]", String(input.amount.amountMinor));
  fields.set("line_items[0][price_data][product_data][name]", input.description.slice(0, 250));
}

function validCheckout(input: Omit<CheckoutInput, "successUrl" | "cancelUrl">): boolean {
  const methods = input.methods ?? [];
  if (!isMoney(input.amount) || input.amount.amountMinor <= 0 || !input.description.trim() || !input.reference || input.reference.length > 200) return false;
  if (!input.idempotencyKey || input.idempotencyKey.length > 255 || methods.some((m) => !METHODS.has(m))) return false;
  // Swish is SEK only and 3-150,000 SEK (verify against https://docs.stripe.com/payments/swish).
  if (methods.includes("swish") && (input.amount.currency !== "SEK" || input.amount.amountMinor < 300 || input.amount.amountMinor > 15_000_000)) return false;
  return true;
}

const amountOf = (data: unknown, key: string, currencyKey = "currency"): Money | undefined => {
  const amount = field(data, key);
  const currency = field(data, currencyKey);
  return typeof amount === "number" && typeof currency === "string" ? { amountMinor: amount, currency: currency.toUpperCase() } : undefined;
};

export function stripePayments(options: { secretKey: string; webhookSecret?: string; fetch: Fetcher }): PaymentsPort {
  const context = { port: "payments" as const, provider: PROVIDER, fetch: options.fetch, secrets: [options.secretKey, options.webhookSecret ?? ""] };
  const post = (path: string, body: URLSearchParams, idempotencyKey: string) =>
    request(context, `https://api.stripe.com${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${options.secretKey}`, "Content-Type": "application/x-www-form-urlencoded", "Stripe-Version": STRIPE_VERSION, "Idempotency-Key": idempotencyKey },
      body: body.toString(),
    }, codeOf);
  const configured = () => SECRET_KEY.test(options.secretKey);

  return {
    info: definition.info,
    async createCheckout(input) {
      if (!configured()) return fail(connectionError("payments", PROVIDER, "not_configured"));
      if (!validCheckout(input) || !/^https:\/\//.test(input.successUrl) || !/^https:\/\//.test(input.cancelUrl)) return fail(connectionError("payments", PROVIDER, "invalid_input"));
      // The reference goes on the PaymentIntent too: Stripe does not copy Session metadata there.
      const body = new URLSearchParams({ mode: "payment", success_url: input.successUrl, cancel_url: input.cancelUrl, client_reference_id: input.reference, "metadata[reference]": input.reference, "payment_intent_data[metadata][reference]": input.reference });
      lineItem(body, input);
      (input.methods ?? []).forEach((method, i) => body.set(`allowed_payment_method_types[${i}]`, method));
      if (input.customerEmail) body.set("customer_email", input.customerEmail);
      if (input.locale) body.set("locale", input.locale);
      const result = await post("/v1/checkout/sessions", body, input.idempotencyKey);
      if (!result.ok) return fail(result.error);
      const id = text(field(result.data, "id"));
      const url = text(field(result.data, "url"));
      const expires = field(result.data, "expires_at");
      if (!id || !url) return fail(connectionError("payments", PROVIDER, "unknown"));
      return ok({ id, url, ...(typeof expires === "number" ? { expiresAt: new Date(expires * 1000).toISOString().replace(/\.\d{3}Z$/, "Z") } : {}) }, "queued", null, id);
    },
    async createPaymentLink(input) {
      if (!configured()) return fail(connectionError("payments", PROVIDER, "not_configured"));
      if (!validCheckout(input) || (input.successUrl && !/^https:\/\//.test(input.successUrl))) return fail(connectionError("payments", PROVIDER, "invalid_input"));
      const body = new URLSearchParams({ "metadata[reference]": input.reference, "payment_intent_data[metadata][reference]": input.reference });
      lineItem(body, input);
      (input.methods ?? []).forEach((method, i) => body.set(`payment_method_types[${i}]`, method)); // verify: Payment Links still take payment_method_types
      if (input.successUrl) {
        body.set("after_completion[type]", "redirect");
        body.set("after_completion[redirect][url]", input.successUrl);
      }
      const result = await post("/v1/payment_links", body, input.idempotencyKey);
      if (!result.ok) return fail(result.error);
      const id = text(field(result.data, "id"));
      const url = text(field(result.data, "url"));
      return id && url ? ok({ id, url }, "queued", null, id) : fail(connectionError("payments", PROVIDER, "unknown"));
    },
    async refund(input) {
      if (!configured()) return fail(connectionError("payments", PROVIDER, "not_configured"));
      if (!/^pi_[A-Za-z0-9]+$/.test(input.paymentId) || !input.idempotencyKey || input.idempotencyKey.length > 255 || (input.amount && (!isMoney(input.amount) || input.amount.amountMinor <= 0))) {
        return fail(connectionError("payments", PROVIDER, "invalid_input"));
      }
      const body = new URLSearchParams({ payment_intent: input.paymentId });
      if (input.amount) body.set("amount", String(input.amount.amountMinor));
      if (input.reason) body.set("reason", input.reason);
      const result = await post("/v1/refunds", body, input.idempotencyKey);
      if (!result.ok) return fail(result.error);
      const id = text(field(result.data, "id"));
      if (!id) return fail(connectionError("payments", PROVIDER, "unknown"));
      const status = field(result.data, "status");
      const state = status === "succeeded" ? "succeeded" : status === "failed" || status === "canceled" ? "failed" : "pending";
      return ok({ id, amount: amountOf(result.data, "amount") ?? null, state }, state === "failed" ? "failed" : "sent", null, id);
    },
    async verifyWebhook(webhook) {
      const header = webhook.headers["stripe-signature"];
      const now = webhook.nowSeconds ?? Math.floor(Date.now() / 1000);
      if (!options.webhookSecret || !header || !verifyStripeSignature(options.webhookSecret, header, webhook.rawBody, now)) return fail(connectionError("payments", PROVIDER, "invalid_signature"));
      let event: unknown;
      try {
        event = JSON.parse(webhook.rawBody);
      } catch {
        return fail(connectionError("payments", PROVIDER, "invalid_input"));
      }
      const id = text(field(event, "id"));
      const object = field(event, "data", "object");
      if (!id) return fail(connectionError("payments", PROVIDER, "invalid_input"));
      const kind = field(event, "type");
      const type: PaymentEvent["type"] =
        kind === "checkout.session.completed" ? "checkout.completed"
          : kind === "payment_intent.succeeded" ? "payment.succeeded"
            : kind === "payment_intent.payment_failed" ? "payment.failed"
              : kind === "refund.updated" || kind === "charge.refund.updated" ? "refund.updated"
                : "other";
      const reference = text(field(object, "client_reference_id")) ?? text(field(object, "metadata", "reference"));
      const paymentId = text(field(object, "payment_intent")) ?? (text(field(object, "object")) === "payment_intent" ? text(field(object, "id")) : undefined);
      const amount = amountOf(object, "amount_total") ?? amountOf(object, "amount");
      return ok({ id, type, ...(reference ? { reference } : {}), ...(paymentId ? { paymentId } : {}), ...(amount ? { amount } : {}) }, "delivered");
    },
  };
}

export const definition: ProviderDefinition<"payments"> = {
  info: { port: "payments", provider: PROVIDER, kind: "live", capabilities: ["checkout", "payment-link", "refund", "webhook", "idempotency"], secrets: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"] },
  secrets: ["STRIPE_SECRET_KEY"],
  optionalSecrets: ["STRIPE_WEBHOOK_SECRET"],
  settings: [],
  create: ({ secrets, fetch }) => stripePayments({ secretKey: secrets.STRIPE_SECRET_KEY, webhookSecret: secrets.STRIPE_WEBHOOK_SECRET, fetch }),
};
