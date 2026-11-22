import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { postmarkEmail } from "@/concept/connections/providers/email/postmark";
import { resendEmail } from "@/concept/connections/providers/email/resend";
import { elksSms } from "@/concept/connections/providers/sms/elks46";
import { twilioSignature, twilioSms } from "@/concept/connections/providers/sms/twilio";
import { verifySvix } from "@/concept/connections/server/svix";
import { networkError, scriptedFetch, timeoutError } from "./helpers/connections-fetch";

// Invented credentials. They only need the right shape.
const SID = "AC0123456789abcdef0123456789abcdef";
const TOKEN = "SECRETtwiliotoken0123456789";
const basic = (user: string, password: string) => `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;

describe("Twilio SMS", () => {
  const sms = (fetch: typeof globalThis.fetch) => twilioSms({ accountSid: SID, authToken: TOKEN, from: "+15005550006", fetch });

  it("posts a form-encoded message with Basic auth and maps the reply", async () => {
    const { fetch, calls } = scriptedFetch({ status: 201, body: { sid: "SM0123", status: "queued", num_segments: "1", price: "-0.0646", price_unit: "USD" } });
    const result = await sms(fetch).send({ to: "+46700000001", body: "Your visit is tomorrow", statusCallbackUrl: "https://salon.example/hooks/twilio" });
    expect(calls[0]).toMatchObject({ method: "POST", url: `https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json` });
    expect(calls[0].headers.authorization).toBe(basic(SID, TOKEN));
    expect(calls[0].headers["content-type"]).toBe("application/x-www-form-urlencoded");
    expect(Object.fromEntries(new URLSearchParams(calls[0].body))).toEqual({ To: "+46700000001", From: "+15005550006", Body: "Your visit is tomorrow", StatusCallback: "https://salon.example/hooks/twilio" });
    expect(result).toEqual({ ok: true, value: { id: "SM0123", to: "+46700000001", segments: 1 }, status: "queued", cost: { amountMinor: 7, currency: "USD" }, providerId: "SM0123" });
  });

  it("refuses a non-E.164 number before any request", async () => {
    const { fetch, calls } = scriptedFetch();
    expect(await sms(fetch).send({ to: "070-123 45 67", body: "Hi" })).toMatchObject({ ok: false, error: { code: "invalid_input" } });
    expect(calls).toHaveLength(0);
  });

  it.each([
    [{ status: 401, body: { code: 20003, message: "Authenticate", status: 401 } }, "unauthorized", "20003"],
    [{ status: 429, body: { code: 20429, message: "Too Many Requests" }, headers: { "retry-after": "2" } }, "rate_limited", "20429"],
    [{ status: 400, body: { code: 21211, message: "Invalid 'To' Phone Number" } }, "invalid_input", "21211"],
    [{ status: 503, body: "<html>down</html>" }, "provider_unavailable", undefined],
  ])("maps %j", async (reply, code, providerCode) => {
    const { fetch } = scriptedFetch(reply);
    const result = await sms(fetch).send({ to: "+46700000001", body: "Hi" });
    expect(result).toMatchObject({ ok: false, error: { code, httpStatus: reply.status, ...(providerCode ? { providerCode } : {}) } });
    if (code === "rate_limited") expect(result).toMatchObject({ error: { retryAfterSeconds: 2, retryable: true } });
  });

  it("maps timeouts and network failures, never retryable for a send that may have gone out", async () => {
    expect(await sms(scriptedFetch(timeoutError()).fetch).send({ to: "+46700000001", body: "Hi" })).toMatchObject({ ok: false, error: { code: "timeout", retryable: false } });
    expect(await sms(scriptedFetch({ status: 500, body: {} }).fetch).send({ to: "+46700000001", body: "Hi" })).toMatchObject({ ok: false, error: { code: "provider_unavailable", retryable: false } });
    expect(await sms(scriptedFetch(networkError()).fetch).send({ to: "+46700000001", body: "Hi" })).toMatchObject({ ok: false, error: { code: "network" } });
  });

  it("matches Twilio's published signature example", () => {
    // https://www.twilio.com/docs/usage/security#explore-the-algorithm-yourself
    const params = new URLSearchParams({ CallSid: "CA1234567890ABCDE", Caller: "+14158675310", Digits: "1234", From: "+14158675310", To: "+18005551212" });
    expect(twilioSignature("12345", "https://example.com/myapp.php?foo=1&bar=2", params)).toBe("L/OH5YylLD5NRKLltdqwSvS0BnU=");
  });

  it("signs repeated fields like Twilio's validator, in linear time", () => {
    const params = new URLSearchParams("b=2&a=1&b=1");
    expect(twilioSignature("k", "https://x.example/h", params)).toBe(createHmac("sha1", "k").update("https://x.example/ha1b1b2").digest("base64"));
    const many = new URLSearchParams(Array.from({ length: 5000 }, (_, i) => [`f${i}`, "v"]));
    const started = performance.now();
    twilioSignature("k", "https://x.example/h", many);
    expect(performance.now() - started).toBeLessThan(500);
  });

  it("verifies a status callback and rejects a tampered one", async () => {
    const url = "https://salon.example/hooks/twilio";
    const rawBody = "MessageSid=SM0123&MessageStatus=delivered";
    const signature = twilioSignature(TOKEN, url, new URLSearchParams(rawBody));
    const adapter = sms(scriptedFetch().fetch);
    expect(await adapter.verifyWebhook!({ url, method: "POST", headers: { "x-twilio-signature": signature }, rawBody })).toMatchObject({ ok: true, value: { providerId: "SM0123", status: "delivered" } });
    expect(await adapter.verifyWebhook!({ url, method: "POST", headers: { "x-twilio-signature": signature }, rawBody: rawBody.replace("delivered", "failed") })).toMatchObject({ ok: false, error: { code: "invalid_signature" } });
    expect(await adapter.verifyWebhook!({ url, method: "POST", headers: {}, rawBody })).toMatchObject({ ok: false, error: { code: "invalid_signature" } });
  });
});

describe("46elks SMS", () => {
  const sms = (fetch: typeof globalThis.fetch, webhookToken?: string) => elksSms({ username: "u0123456789", password: "SECRETelkspassword", from: "Salon", webhookToken, fetch });

  it("posts to /a1/sms and converts cost from 1/10,000 units", async () => {
    const { fetch, calls } = scriptedFetch({ status: 200, body: { id: "s17a6dafb12d7", status: "created", parts: 1, cost: 5200 } });
    const result = await sms(fetch).send({ to: "+46700000001", body: "Hej", statusCallbackUrl: "https://salon.example/hooks/46elks?token=x" });
    expect(calls[0].url).toBe("https://api.46elks.com/a1/sms");
    expect(calls[0].headers.authorization).toBe(basic("u0123456789", "SECRETelkspassword"));
    expect(Object.fromEntries(new URLSearchParams(calls[0].body))).toEqual({ to: "+46700000001", from: "Salon", message: "Hej", whendelivered: "https://salon.example/hooks/46elks?token=x" });
    expect(result).toMatchObject({ ok: true, status: "queued", cost: { amountMinor: 52, currency: "SEK" }, providerId: "s17a6dafb12d7" });
  });

  it("maps 403 (no credit) and plain-text errors by status only", async () => {
    const { fetch } = scriptedFetch({ status: 403, body: "Not enough credits" });
    expect(await sms(fetch).send({ to: "+46700000001", body: "Hej" })).toMatchObject({ ok: false, error: { code: "forbidden", httpStatus: 403 } });
  });

  it("accepts a delivery report only with the callback's Basic credentials, never a query token", async () => {
    const token = "tok0123456789abcdef";
    const adapter = sms(scriptedFetch().fetch, token);
    const report = { method: "POST", url: "https://salon.example/hooks/46elks", rawBody: "id=s17a6dafb12d7&status=delivered&delivered=2026-11-18T09%3A00%3A00Z" };
    expect(await adapter.verifyWebhook!({ ...report, headers: { authorization: basic("46elks", token) } })).toMatchObject({ ok: true, value: { status: "delivered" } });
    expect(await adapter.verifyWebhook!({ ...report, headers: { authorization: basic("46elks", "guess") } })).toMatchObject({ ok: false, error: { code: "invalid_signature" } });
    expect(await adapter.verifyWebhook!({ ...report, url: `${report.url}?token=${token}`, headers: {} })).toMatchObject({ ok: false, error: { code: "invalid_signature" } });
    expect(await sms(scriptedFetch().fetch).verifyWebhook!({ ...report, headers: { authorization: basic("46elks", token) } })).toMatchObject({ ok: false });
  });
});

describe("Resend email", () => {
  const email = (fetch: typeof globalThis.fetch, webhookSecret?: string) => resendEmail({ apiKey: "re_SECRET_0123456789abcdef", webhookSecret, fetch });
  const message = { to: ["guest@example.com"], from: "Salon <hello@salon.example>", subject: "Your booking", text: "See you", tags: { kind: "reminder" }, idempotencyKey: "b-1-reminder" };

  it("posts JSON with bearer auth and the idempotency key", async () => {
    const { fetch, calls } = scriptedFetch({ status: 200, body: { id: "4ef9a417-02e9-4d39-ad75-9611e0fcc33c" } });
    const result = await email(fetch).send(message);
    expect(calls[0].url).toBe("https://api.resend.com/emails");
    expect(calls[0].headers).toMatchObject({ authorization: "Bearer re_SECRET_0123456789abcdef", "idempotency-key": "b-1-reminder", "content-type": "application/json" });
    expect(JSON.parse(calls[0].body)).toEqual({ from: message.from, to: message.to, subject: message.subject, text: message.text, tags: [{ name: "kind", value: "reminder" }] });
    expect(result).toMatchObject({ ok: true, providerId: "4ef9a417-02e9-4d39-ad75-9611e0fcc33c" });
  });

  it("maps quota, idempotency conflict and validation errors", async () => {
    expect(await email(scriptedFetch({ status: 429, body: { name: "daily_quota_exceeded", statusCode: 429 } }).fetch).send(message)).toMatchObject({ ok: false, error: { code: "rejected", providerCode: "daily_quota_exceeded" } });
    expect(await email(scriptedFetch({ status: 429, body: { name: "rate_limit_exceeded" }, headers: { "retry-after": "1" } }).fetch).send(message)).toMatchObject({ ok: false, error: { code: "rate_limited", retryAfterSeconds: 1 } });
    expect(await email(scriptedFetch({ status: 409, body: { name: "invalid_idempotent_request" } }).fetch).send(message)).toMatchObject({ ok: false, error: { code: "conflict" } });
    expect(await email(scriptedFetch({ status: 422, body: { name: "validation_error" } }).fetch).send(message)).toMatchObject({ ok: false, error: { code: "invalid_input" } });
    expect(await email(scriptedFetch(timeoutError()).fetch).send(message)).toMatchObject({ ok: false, error: { code: "timeout", retryable: true } });
    expect(await email(scriptedFetch(timeoutError()).fetch).send({ ...message, idempotencyKey: undefined })).toMatchObject({ ok: false, error: { code: "timeout", retryable: false } });
  });

  it("matches Svix's documented example signature", () => {
    // https://docs.svix.com/receiving/verifying-payloads/how-manual#example-signatures
    const headers = { "svix-id": "msg_loFOjxBNrRLzqYUf", "svix-timestamp": "1731705121", "svix-signature": "v1,rAvfW3dJ/X/qxhsaXPOyyCGmRKsaKWcsNccKXlIktD0=" };
    const body = '{"event_type":"ping","data":{"success":true}}';
    expect(verifySvix("whsec_plJ3nmyCDGBKInavdOK15jsl", headers, body, 1731705121)).toBe(true);
    expect(verifySvix("whsec_plJ3nmyCDGBKInavdOK15jsl", headers, body, 1731705121 + 301)).toBe(false);
    expect(verifySvix("whsec_plJ3nmyCDGBKInavdOK15jsl", headers, body.replace("true", "false"), 1731705121)).toBe(false);
  });

  it("treats a suppressed message as failed", async () => {
    const secret = "whsec_" + Buffer.from("invented-webhook-key").toString("base64");
    const rawBody = JSON.stringify({ type: "email.suppressed", data: { email_id: "4ef9" } });
    const signature = createHmac("sha256", Buffer.from("invented-webhook-key")).update(`msg_2.1800000000.${rawBody}`).digest("base64");
    const headers = { "svix-id": "msg_2", "svix-timestamp": "1800000000", "svix-signature": `v1,${signature}` };
    expect(await email(scriptedFetch().fetch, secret).verifyWebhook!({ url: "https://salon.example/h", method: "POST", headers, rawBody, nowSeconds: 1800000000 })).toMatchObject({ ok: true, value: { status: "failed" } });
  });

  it("parses a verified delivery event", async () => {
    const secret = "whsec_" + Buffer.from("invented-webhook-key").toString("base64");
    const rawBody = JSON.stringify({ type: "email.delivered", data: { email_id: "4ef9" } });
    const signature = createHmac("sha256", Buffer.from("invented-webhook-key")).update(`msg_1.1800000000.${rawBody}`).digest("base64");
    const headers = { "svix-id": "msg_1", "svix-timestamp": "1800000000", "svix-signature": `v1,${signature}` };
    expect(await email(scriptedFetch().fetch, secret).verifyWebhook!({ url: "https://salon.example/h", method: "POST", headers, rawBody, nowSeconds: 1800000010 })).toMatchObject({ ok: true, value: { providerId: "4ef9", status: "delivered" } });
    expect(await email(scriptedFetch().fetch).verifyWebhook!({ url: "https://salon.example/h", method: "POST", headers, rawBody, nowSeconds: 1800000010 })).toMatchObject({ ok: false, error: { code: "invalid_signature" } });
  });
});

describe("Postmark email", () => {
  const email = (fetch: typeof globalThis.fetch) => postmarkEmail({ serverToken: "SECRETpostmarktoken", webhookUser: "hooks", webhookPassword: "SECRETpostmarkhookpw", fetch });
  const message = { to: ["a@example.com", "b@example.com"], from: "hello@salon.example", subject: "Hi", text: "Body", tags: { kind: "receipt" } };

  it("posts PascalCase JSON with the server token header", async () => {
    const { fetch, calls } = scriptedFetch({ status: 200, body: { MessageID: "b7bc2f4a", ErrorCode: 0, Message: "OK" } });
    expect(await email(fetch).send(message)).toMatchObject({ ok: true, providerId: "b7bc2f4a" });
    expect(calls[0].url).toBe("https://api.postmarkapp.com/email");
    expect(calls[0].headers["x-postmark-server-token"]).toBe("SECRETpostmarktoken");
    expect(JSON.parse(calls[0].body)).toMatchObject({ From: message.from, To: "a@example.com,b@example.com", Subject: "Hi", TextBody: "Body", Tag: "receipt", Metadata: { kind: "receipt" } });
  });

  it("turns link and open tracking off for a message that asks, and leaves the provider's setting otherwise", async () => {
    const off = scriptedFetch({ status: 200, body: { MessageID: "b7bc2f4a", ErrorCode: 0, Message: "OK" } });
    await email(off.fetch).send({ ...message, tracking: false });
    expect(JSON.parse(off.calls[0].body)).toMatchObject({ TrackLinks: "None", TrackOpens: false });
    const plain = scriptedFetch({ status: 200, body: { MessageID: "b7bc2f4a", ErrorCode: 0, Message: "OK" } });
    await email(plain.fetch).send(message);
    expect(JSON.parse(plain.calls[0].body)).not.toHaveProperty("TrackLinks");
  });

  it("maps ErrorCode inside a 422", async () => {
    expect(await email(scriptedFetch({ status: 422, body: { ErrorCode: 406, Message: "Inactive recipient" } }).fetch).send(message)).toMatchObject({ ok: false, error: { code: "rejected", providerCode: "406" } });
    expect(await email(scriptedFetch({ status: 422, body: { ErrorCode: 300, Message: "Invalid email" } }).fetch).send(message)).toMatchObject({ ok: false, error: { code: "invalid_input", providerCode: "300" } });
    expect(await email(scriptedFetch({ status: 401, body: { ErrorCode: 10, Message: "Bad token" } }).fetch).send(message)).toMatchObject({ ok: false, error: { code: "unauthorized" } });
  });

  it("accepts webhooks only with the configured Basic credentials", async () => {
    const rawBody = JSON.stringify({ RecordType: "Delivery", MessageID: "b7bc2f4a" });
    const adapter = email(scriptedFetch().fetch);
    expect(await adapter.verifyWebhook!({ url: "https://salon.example/h", method: "POST", headers: { authorization: basic("hooks", "SECRETpostmarkhookpw") }, rawBody })).toMatchObject({ ok: true, value: { status: "delivered" } });
    expect(await adapter.verifyWebhook!({ url: "https://salon.example/h", method: "POST", headers: { authorization: basic("hooks", "wrong") }, rawBody })).toMatchObject({ ok: false, error: { code: "invalid_signature" } });
  });
});
