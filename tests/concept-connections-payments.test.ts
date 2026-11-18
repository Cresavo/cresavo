import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { STRIPE_VERSION, stripePayments, verifyStripeSignature } from "@/concept/connections/providers/payments/stripe";
import { scriptedFetch } from "./helpers/connections-fetch";

const KEY = "sk_test_SECRETinvented0123456789";
const HOOK = "whsec_SECRETinventedhooksecret";
const checkout = {
  amount: { amountMinor: 49900, currency: "SEK" },
  description: "Haircut 45 min",
  reference: "b-123",
  successUrl: "https://salon.example/paid",
  cancelUrl: "https://salon.example/cancel",
  methods: ["card", "klarna", "swish"] as const,
  idempotencyKey: "b-123-checkout",
};
const sign = (body: string, t: number, secret = HOOK) => `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;

describe("Stripe payments", () => {
  const payments = (fetch: typeof globalThis.fetch) => stripePayments({ secretKey: KEY, webhookSecret: HOOK, fetch });

  it("creates a Checkout Session with inline price, Swedish methods, version and idempotency key", async () => {
    const { fetch, calls } = scriptedFetch({ status: 200, body: { id: "cs_test_a1", url: "https://checkout.stripe.com/c/pay/cs_test_a1", expires_at: 1800000000 } });
    const result = await payments(fetch).createCheckout({ ...checkout, methods: [...checkout.methods] });
    expect(calls[0].url).toBe("https://api.stripe.com/v1/checkout/sessions");
    expect(calls[0].headers).toMatchObject({ authorization: `Bearer ${KEY}`, "stripe-version": STRIPE_VERSION, "idempotency-key": "b-123-checkout", "content-type": "application/x-www-form-urlencoded" });
    expect(Object.fromEntries(new URLSearchParams(calls[0].body))).toEqual({
      mode: "payment",
      success_url: "https://salon.example/paid",
      cancel_url: "https://salon.example/cancel",
      client_reference_id: "b-123",
      "metadata[reference]": "b-123",
      "payment_intent_data[metadata][reference]": "b-123",
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": "sek",
      "line_items[0][price_data][unit_amount]": "49900",
      "line_items[0][price_data][product_data][name]": "Haircut 45 min",
      "allowed_payment_method_types[0]": "card",
      "allowed_payment_method_types[1]": "klarna",
      "allowed_payment_method_types[2]": "swish",
    });
    expect(result).toEqual({ ok: true, value: { id: "cs_test_a1", url: "https://checkout.stripe.com/c/pay/cs_test_a1", expiresAt: "2027-01-15T08:00:00Z" }, status: "queued", cost: null, providerId: "cs_test_a1" });
  });

  it("refuses Swish outside SEK or its amount range, and anything without a key shape", async () => {
    const { fetch, calls } = scriptedFetch();
    expect(await payments(fetch).createCheckout({ ...checkout, methods: ["swish"], amount: { amountMinor: 49900, currency: "EUR" } })).toMatchObject({ ok: false, error: { code: "invalid_input" } });
    expect(await payments(fetch).createCheckout({ ...checkout, methods: ["swish"], amount: { amountMinor: 200, currency: "SEK" } })).toMatchObject({ ok: false, error: { code: "invalid_input" } });
    expect(await stripePayments({ secretKey: "nope", fetch }).createCheckout({ ...checkout, methods: [] })).toMatchObject({ ok: false, error: { code: "not_configured" } });
    expect(calls).toHaveLength(0);
  });

  it("creates a payment link and a partial refund with idempotency keys", async () => {
    const { fetch, calls } = scriptedFetch(
      { status: 200, body: { id: "plink_1", url: "https://buy.stripe.com/test_1" } },
      { status: 200, body: { id: "re_1", status: "pending", amount: 10000, currency: "sek" } },
    );
    const adapter = payments(fetch);
    expect(await adapter.createPaymentLink({ ...checkout, methods: ["card"] })).toMatchObject({ ok: true, value: { url: "https://buy.stripe.com/test_1" } });
    expect(calls[0].url).toBe("https://api.stripe.com/v1/payment_links");
    expect(await adapter.refund({ paymentId: "pi_123", amount: { amountMinor: 10000, currency: "SEK" }, idempotencyKey: "b-123-refund-1" })).toEqual({ ok: true, value: { id: "re_1", amount: { amountMinor: 10000, currency: "SEK" }, state: "pending" }, status: "sent", cost: null, providerId: "re_1" });
    expect(Object.fromEntries(new URLSearchParams(calls[1].body))).toEqual({ payment_intent: "pi_123", amount: "10000" });
    expect(calls[1].headers["idempotency-key"]).toBe("b-123-refund-1");
  });

  it.each([
    [402, { error: { type: "card_error", code: "card_declined", message: "Your card was declined." } }, "rejected", "card_declined"],
    [400, { error: { type: "idempotency_error", message: "Keys for idempotent requests can only be used with the same parameters" } }, "conflict", "idempotency_error"],
    [401, { error: { type: "invalid_request_error", message: `Invalid API Key provided: ${KEY}` } }, "unauthorized", "invalid_request_error"],
    [429, { error: { type: "invalid_request_error", code: "rate_limit" } }, "rate_limited", "rate_limit"],
    [500, { error: { type: "api_error" } }, "provider_unavailable", "api_error"],
  ])("maps HTTP %i", async (status, body, code, providerCode) => {
    const result = await payments(scriptedFetch({ status, body }).fetch).createCheckout({ ...checkout, methods: [] });
    expect(result).toMatchObject({ ok: false, error: { code, providerCode, httpStatus: status } });
    expect(JSON.stringify(result)).not.toContain(KEY);
  });

  describe("webhook signatures", () => {
    const body = JSON.stringify({ id: "evt_1", type: "checkout.session.completed", data: { object: { object: "checkout.session", client_reference_id: "b-123", payment_intent: "pi_123", amount_total: 49900, currency: "sek" } } });
    const now = 1800000000;

    it("accepts a valid signature and parses the event", async () => {
      const result = await payments(scriptedFetch().fetch).verifyWebhook({ url: "https://salon.example/h", method: "POST", headers: { "stripe-signature": sign(body, now) }, rawBody: body, nowSeconds: now + 5 });
      expect(result).toMatchObject({ ok: true, value: { id: "evt_1", type: "checkout.completed", reference: "b-123", paymentId: "pi_123", amount: { amountMinor: 49900, currency: "SEK" } } });
    });

    it("uses the whole whsec_ string as the HMAC key (not base64-decoded)", () => {
      const decoded = `t=${now},v1=${createHmac("sha256", Buffer.from(HOOK.slice(6), "base64")).update(`${now}.${body}`).digest("hex")}`;
      expect(verifyStripeSignature(HOOK, decoded, body, now)).toBe(false);
      expect(verifyStripeSignature(HOOK, sign(body, now), body, now)).toBe(true);
    });

    it("accepts any of several v1 signatures (secret rotation)", () => {
      const header = `${sign(body, now, "whsec_SECRETold")},v1=${sign(body, now).split("v1=")[1]}`;
      expect(verifyStripeSignature(HOOK, header, body, now)).toBe(true);
    });

    it.each([
      ["a tampered body", sign(body, now), body.replace("49900", "1"), now],
      ["an old timestamp", sign(body, now), body, now + 301],
      ["a wrong secret", sign(body, now, "whsec_SECRETother"), body, now],
      ["no v1 entry", `t=${now},v0=abc`, body, now],
    ])("rejects %s", async (_label, header, rawBody, nowSeconds) => {
      expect(await payments(scriptedFetch().fetch).verifyWebhook({ url: "https://salon.example/h", method: "POST", headers: { "stripe-signature": header }, rawBody, nowSeconds })).toMatchObject({ ok: false, error: { code: "invalid_signature" } });
    });

    it("rejects everything when no webhook secret is configured", async () => {
      const adapter = stripePayments({ secretKey: KEY, fetch: scriptedFetch().fetch });
      expect(await adapter.verifyWebhook({ url: "https://salon.example/h", method: "POST", headers: { "stripe-signature": sign(body, now) }, rawBody: body, nowSeconds: now })).toMatchObject({ ok: false, error: { code: "invalid_signature" } });
    });
  });
});
