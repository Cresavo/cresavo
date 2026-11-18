import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import type { Voucher } from "@/concept/connections/ports/accounting";
import { fortnoxAccounting } from "@/concept/connections/providers/accounting/fortnox";
import { vismaAccounting } from "@/concept/connections/providers/accounting/visma";
import { googleCalendar } from "@/concept/connections/providers/calendar/google";
import { googleEventId } from "@/concept/connections/providers/calendar/ids";
import { microsoftCalendar } from "@/concept/connections/providers/calendar/microsoft";
import { googleReserve } from "@/concept/connections/providers/listing/google-reserve";
import { appSecretProof, metaSocial, verifyMetaSignature } from "@/concept/connections/providers/social/meta";
import { clearTokenCache, type OAuthClient } from "@/concept/connections/server/oauth";
import { scriptedFetch } from "./helpers/connections-fetch";

const oauth = (tokenUrl: string, clientAuth: OAuthClient["clientAuth"]): OAuthClient => ({ tokenUrl, clientId: "client-1", clientSecret: "SECRETclientsecret", refreshToken: "SECRETrefreshtoken", clientAuth });
const token = { status: 200, body: { access_token: "SECRETaccesstoken0123", expires_in: 3600, token_type: "Bearer" } };
const voucher: Voucher = {
  date: "2026-11-16",
  description: "Daily sales 2026-11-16",
  currency: "SEK",
  reference: "day-2026-11-16",
  rows: [
    { account: "1580", debitMinor: 125050, creditMinor: 0 },
    { account: "3001", debitMinor: 0, creditMinor: 100040, description: "Sales 25%" },
    { account: "2611", debitMinor: 0, creditMinor: 25010, description: "VAT 25%" },
  ],
};

beforeEach(() => clearTokenCache());

describe("OAuth refresh", () => {
  it("refreshes once with Basic client auth and caches the access token", async () => {
    const { fetch, calls } = scriptedFetch(token, { status: 201, body: { Voucher: { VoucherNumber: 12, VoucherSeries: "A" } } }, { status: 201, body: { Voucher: { VoucherNumber: 13, VoucherSeries: "A" } } });
    const adapter = fortnoxAccounting({ oauth: oauth("https://apps.fortnox.se/oauth-v1/token", "basic"), fetch });
    await adapter.postVoucher(voucher);
    await adapter.postVoucher({ ...voucher, reference: "day-2" });
    expect(calls.map((c) => c.url)).toEqual(["https://apps.fortnox.se/oauth-v1/token", "https://api.fortnox.se/3/vouchers", "https://api.fortnox.se/3/vouchers"]);
    expect(calls[0].headers.authorization).toBe(`Basic ${Buffer.from("client-1:SECRETclientsecret").toString("base64")}`);
    expect(Object.fromEntries(new URLSearchParams(calls[0].body))).toEqual({ grant_type: "refresh_token", refresh_token: "SECRETrefreshtoken" });
  });

  it("uses a rotated refresh token on the next refresh", async () => {
    const { fetch, calls } = scriptedFetch(
      { status: 200, body: { access_token: "SECRETaccess1", refresh_token: "SECRETrotated", expires_in: 1 } },
      { status: 201, body: { Voucher: { VoucherNumber: 1, VoucherSeries: "A" } } },
      { status: 200, body: { access_token: "SECRETaccess2", expires_in: 3600 } },
      { status: 201, body: { Voucher: { VoucherNumber: 2, VoucherSeries: "A" } } },
    );
    const adapter = fortnoxAccounting({ oauth: oauth("https://apps.fortnox.se/oauth-v1/token", "basic"), fetch });
    await adapter.postVoucher(voucher);
    await adapter.postVoucher({ ...voucher, reference: "day-2" });
    expect(new URLSearchParams(calls[2].body).get("refresh_token")).toBe("SECRETrotated");
  });

  it("maps invalid_grant to unauthorized without calling the API", async () => {
    const { fetch, calls } = scriptedFetch({ status: 400, body: { error: "invalid_grant", error_description: "Token SECRETrefreshtoken expired" } });
    const result = await fortnoxAccounting({ oauth: oauth("https://apps.fortnox.se/oauth-v1/token", "basic"), fetch }).postVoucher(voucher);
    expect(result).toMatchObject({ ok: false, error: { code: "unauthorized", providerCode: "invalid_grant" } });
    expect(calls).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain("SECRET");
  });
});

describe("Fortnox vouchers", () => {
  it("posts a balanced voucher in major units with the reference in the description", async () => {
    const { fetch, calls } = scriptedFetch(token, { status: 201, body: { Voucher: { VoucherNumber: 12, VoucherSeries: "A" } } });
    const result = await fortnoxAccounting({ oauth: oauth("https://apps.fortnox.se/oauth-v1/token", "basic"), fetch }).postVoucher(voucher);
    expect(calls[1].headers.authorization).toBe("Bearer SECRETaccesstoken0123");
    expect(JSON.parse(calls[1].body)).toEqual({
      Voucher: {
        VoucherSeries: "A",
        TransactionDate: "2026-11-16",
        Description: "Daily sales 2026-11-16 [day-2026-11-16]",
        VoucherRows: [
          { Account: 1580, Debit: 1250.5, Credit: 0 },
          { Account: 3001, Debit: 0, Credit: 1000.4, TransactionInformation: "Sales 25%" },
          { Account: 2611, Debit: 0, Credit: 250.1, TransactionInformation: "VAT 25%" },
        ],
      },
    });
    expect(result).toMatchObject({ ok: true, value: { id: "A12", series: "A" } });
  });

  it("keeps the whole reference when a long description is cut", async () => {
    const { fetch, calls } = scriptedFetch(token, { status: 201, body: { Voucher: { VoucherNumber: 1, VoucherSeries: "A" } } });
    await fortnoxAccounting({ oauth: oauth("https://apps.fortnox.se/oauth-v1/token", "basic"), fetch }).postVoucher({ ...voucher, description: "x".repeat(300) });
    const description = JSON.parse(calls[1].body).Voucher.Description;
    expect(description).toHaveLength(200);
    expect(description.endsWith(" [day-2026-11-16]")).toBe(true);
  });

  it("refuses unbalanced vouchers and other currencies before any request", async () => {
    const { fetch, calls } = scriptedFetch();
    const adapter = fortnoxAccounting({ oauth: oauth("https://apps.fortnox.se/oauth-v1/token", "basic"), fetch });
    expect(await adapter.postVoucher({ ...voucher, rows: voucher.rows.slice(0, 2) })).toMatchObject({ ok: false, error: { code: "invalid_input" } });
    expect(await adapter.postVoucher({ ...voucher, currency: "EUR" })).toMatchObject({ ok: false, error: { code: "not_supported" } });
    expect(calls).toHaveLength(0);
  });

  it("maps ErrorInformation and the 25 per 5 s limit", async () => {
    const { fetch } = scriptedFetch(token, { status: 400, body: { ErrorInformation: { error: 1, message: "Account 9999 is missing", code: 2000423 } } });
    expect(await fortnoxAccounting({ oauth: oauth("https://apps.fortnox.se/oauth-v1/token", "basic"), fetch }).postVoucher(voucher)).toMatchObject({ ok: false, error: { code: "invalid_input", providerCode: "2000423" } });
    clearTokenCache();
    const limited = scriptedFetch(token, { status: 429, body: {} });
    expect(await fortnoxAccounting({ oauth: oauth("https://apps.fortnox.se/oauth-v1/token", "basic"), fetch: limited.fetch }).postVoucher(voucher)).toMatchObject({ ok: false, error: { code: "rate_limited", retryable: true } });
  });
});

describe("Visma eAccounting vouchers", () => {
  it("posts Rows with DebitAmount or CreditAmount", async () => {
    const { fetch, calls } = scriptedFetch(token, { status: 201, body: { Id: "7b0c8f1e" } });
    const result = await vismaAccounting({ oauth: oauth("https://identity.vismaonline.com/connect/token", "basic"), fetch }).postVoucher(voucher);
    expect(calls[1].url).toBe("https://eaccountingapi.vismaonline.com/v2/vouchers");
    expect(JSON.parse(calls[1].body)).toEqual({
      VoucherDate: "2026-11-16",
      VoucherText: "Daily sales 2026-11-16 [day-2026-11-16]",
      Rows: [
        { AccountNumber: 1580, DebitAmount: 1250.5 },
        { AccountNumber: 3001, CreditAmount: 1000.4, TransactionText: "Sales 25%" },
        { AccountNumber: 2611, CreditAmount: 250.1, TransactionText: "VAT 25%" },
      ],
    });
    expect(result).toMatchObject({ ok: true, providerId: "7b0c8f1e" });
  });

  it("maps ErrorCode 4010 to rate_limited", async () => {
    const { fetch } = scriptedFetch(token, { status: 429, body: { ErrorCode: 4010, DeveloperErrorMessage: "Too many requests", ErrorId: "x" } });
    expect(await vismaAccounting({ oauth: oauth("https://identity.vismaonline.com/connect/token", "basic"), fetch }).postVoucher(voucher)).toMatchObject({ ok: false, error: { code: "rate_limited", providerCode: "4010" } });
  });
});

describe("Google Calendar", () => {
  const calendar = (fetch: typeof globalThis.fetch) => googleCalendar({ oauth: oauth("https://oauth2.googleapis.com/token", "body"), fetch });
  const event = { id: "b-123", title: "Haircut", start: "2026-11-18T09:00:00Z", end: "2026-11-18T09:45:00Z", timeZone: "Europe/Stockholm" };

  it("inserts with a deterministic base32hex id and updates the existing event on 409 duplicate", async () => {
    const { fetch, calls } = scriptedFetch(token, { status: 409, body: { error: { code: 409, message: "The requested identifier already exists.", errors: [{ reason: "duplicate" }] } } }, { status: 200, body: { id: googleEventId("b-123") } });
    const result = await calendar(fetch).pushEvent("primary", event);
    expect(Object.fromEntries(new URLSearchParams(calls[0].body))).toMatchObject({ grant_type: "refresh_token", client_id: "client-1", client_secret: "SECRETclientsecret" });
    expect(calls[1].url).toBe("https://www.googleapis.com/calendar/v3/calendars/primary/events");
    const body = JSON.parse(calls[1].body);
    expect(body).toMatchObject({ id: googleEventId("b-123"), summary: "Haircut", start: { dateTime: event.start, timeZone: "Europe/Stockholm" }, extendedProperties: { private: { cresavoId: "b-123" } } });
    expect(body.id).toMatch(/^[0-9a-v]{5,1024}$/);
    expect(calls[2]).toMatchObject({ method: "PUT", url: `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId("b-123")}` });
    expect(JSON.parse(calls[2].body)).toMatchObject({ start: { dateTime: event.start }, end: { dateTime: event.end } });
    expect(result).toMatchObject({ ok: true, value: { providerEventId: googleEventId("b-123") } });
  });

  it("pages an incremental pull and flags a 410 for a full resync", async () => {
    const { fetch, calls } = scriptedFetch(
      token,
      { status: 200, body: { items: [{ id: "e1", status: "confirmed", start: { dateTime: "2026-11-18T10:00:00+01:00" }, end: { dateTime: "2026-11-18T11:00:00+01:00" } }], nextPageToken: "p2" } },
      { status: 200, body: { timeZone: "Europe/Stockholm", items: [{ id: "e2", status: "cancelled" }, { id: "e3", transparency: "transparent", start: { dateTime: "2026-11-18T12:00:00Z" }, end: { dateTime: "2026-11-18T13:00:00Z" } }, { id: "e4", start: { date: "2026-11-19" }, end: { date: "2026-11-20" } }], nextSyncToken: "sync-2" } },
      { status: 410, body: { error: { code: 410, errors: [{ reason: "fullSyncRequired" }] } } },
    );
    const adapter = calendar(fetch);
    const pulled = await adapter.pullEvents({ calendarId: "primary", syncToken: "sync-1" });
    expect(pulled).toMatchObject({ ok: true, value: { events: [{ providerEventId: "e1", start: "2026-11-18T09:00:00Z", end: "2026-11-18T10:00:00Z", cancelled: false }, { providerEventId: "e2", cancelled: true }, { providerEventId: "e3", cancelled: true }, { providerEventId: "e4", start: "2026-11-18T23:00:00Z", end: "2026-11-19T23:00:00Z", cancelled: false }], nextSyncToken: "sync-2", fullResyncRequired: false } });
    expect(new URL(calls[2].url).searchParams.get("pageToken")).toBe("p2");
    expect(new URL(calls[2].url).searchParams.get("syncToken")).toBe("sync-1");
    expect(await adapter.pullEvents({ calendarId: "primary", syncToken: "sync-2" })).toMatchObject({ ok: true, value: { fullResyncRequired: true } });
  });

  it("fails a pull whose body is unreadable instead of reporting a free calendar", async () => {
    const { fetch } = scriptedFetch(token, { status: 200, body: "{\"items\": [" });
    expect(await calendar(fetch).pullEvents({ calendarId: "primary", from: "2026-11-18T00:00:00Z", to: "2026-11-19T00:00:00Z" })).toMatchObject({ ok: false, error: { code: "unknown" } });
  });

  it("returns a page token instead of looping when there are more pages than one call reads", async () => {
    const page = { status: 200, body: { items: [], nextPageToken: "more" } };
    const { fetch } = scriptedFetch(token, ...Array.from({ length: 10 }, () => page));
    expect(await calendar(fetch).pullEvents({ calendarId: "primary", from: "2026-11-18T00:00:00Z", to: "2026-11-19T00:00:00Z" })).toMatchObject({ ok: true, value: { nextPageToken: "more", fullResyncRequired: false } });
  });

  it("compares times as instants", async () => {
    const { fetch } = scriptedFetch(token, { status: 200, body: { id: "x" } });
    expect(await calendar(fetch).pushEvent("primary", { ...event, start: "2026-11-18T09:00:00Z", end: "2026-11-18T09:00:00.500Z" })).toMatchObject({ ok: true });
  });

  it("maps 403 rateLimitExceeded to rate_limited", async () => {
    const { fetch } = scriptedFetch(token, { status: 403, body: { error: { code: 403, errors: [{ reason: "rateLimitExceeded" }] } } });
    expect(await calendar(fetch).pushEvent("primary", event)).toMatchObject({ ok: false, error: { code: "rate_limited", providerCode: "rateLimitExceeded" } });
  });
});

describe("Microsoft Graph calendar", () => {
  const calendar = (fetch: typeof globalThis.fetch) => microsoftCalendar({ oauth: oauth("https://login.microsoftonline.com/common/oauth2/v2.0/token", "body"), user: "owner@salon.example", fetch });

  it("creates an event in UTC with a transactionId", async () => {
    const { fetch, calls } = scriptedFetch(token, { status: 201, body: { id: "AAMkAG" } });
    const result = await calendar(fetch).pushEvent("primary", { id: "b-123", title: "Haircut", start: "2026-11-18T09:00:00Z", end: "2026-11-18T09:45:00Z", timeZone: "Europe/Stockholm" });
    expect(calls[1].url).toBe("https://graph.microsoft.com/v1.0/users/owner%40salon.example/events");
    expect(calls[1].headers.prefer).toBe('outlook.timezone="UTC"');
    expect(JSON.parse(calls[1].body)).toMatchObject({ subject: "Haircut", start: { dateTime: "2026-11-18T09:00:00", timeZone: "UTC" }, end: { dateTime: "2026-11-18T09:45:00", timeZone: "UTC" } });
    expect(JSON.parse(calls[1].body).transactionId).toMatch(/^[0-9a-f]{36}$/);
    expect(result).toMatchObject({ ok: true, value: { providerEventId: "AAMkAG" } });
  });

  it("refuses to pull a secondary calendar instead of returning the primary one", async () => {
    const { fetch, calls } = scriptedFetch(token);
    expect(await calendar(fetch).pullEvents({ calendarId: "staff-erik", from: "2026-11-18T00:00:00Z", to: "2026-11-25T00:00:00Z" })).toMatchObject({ ok: false, error: { code: "not_supported" } });
    expect(calls).toHaveLength(0);
  });

  it("follows delta links only back to Graph", async () => {
    const { fetch, calls } = scriptedFetch(token);
    expect(await calendar(fetch).pullEvents({ calendarId: "primary", syncToken: "https://evil.example/steal" })).toMatchObject({ ok: false, error: { code: "invalid_input" } });
    expect(calls).toHaveLength(0);
  });

  it("reads removed events and keeps the delta link", async () => {
    const delta = "https://graph.microsoft.com/v1.0/users/owner%40salon.example/calendarView/delta?$deltatoken=abc";
    const { fetch } = scriptedFetch(token, { status: 200, body: { value: [{ id: "A1", start: { dateTime: "2026-11-18T09:00:00.0000000" }, end: { dateTime: "2026-11-18T10:00:00.0000000" } }, { id: "A2", "@removed": { reason: "deleted" } }], "@odata.deltaLink": delta } });
    expect(await calendar(fetch).pullEvents({ calendarId: "primary", from: "2026-11-18T00:00:00Z", to: "2026-11-25T00:00:00Z" })).toMatchObject({
      ok: true,
      value: { events: [{ providerEventId: "A1", start: "2026-11-18T09:00:00Z", cancelled: false }, { providerEventId: "A2", cancelled: true }], nextSyncToken: delta },
    });
  });

  it("maps 429 with Retry-After", async () => {
    const { fetch } = scriptedFetch(token, { status: 429, body: { error: { code: "ApplicationThrottled", message: "slow down" } }, headers: { "retry-after": "7" } });
    expect(await calendar(fetch).pushEvent("primary", { id: "b", title: "x", start: "2026-11-18T09:00:00Z", end: "2026-11-18T09:45:00Z", timeZone: "UTC" })).toMatchObject({ ok: false, error: { code: "rate_limited", retryAfterSeconds: 7, providerCode: "ApplicationThrottled" } });
  });
});

describe("Reserve with Google booking server", () => {
  const listing = googleReserve({ username: "google", password: "SECRETbookingserverpw" });
  const auth = `Basic ${Buffer.from("google:SECRETbookingserverpw").toString("base64")}`;

  it("authenticates and parses CreateBooking with its idempotency token", async () => {
    const rawBody = JSON.stringify({ slot: { merchant_id: "m-1", service_id: "s-1", start_sec: "1800000000", duration_sec: "2700" }, idempotency_token: "tok-1" });
    expect(await listing.authenticateBookingCall({ url: "https://salon.example/api/reserve/v3/CreateBooking/", method: "POST", headers: { authorization: auth }, rawBody })).toMatchObject({ ok: true, value: { method: "CreateBooking", idempotencyToken: "tok-1" } });
    expect(await listing.authenticateBookingCall({ url: "https://salon.example/api/reserve/v3/CreateBooking/", method: "POST", headers: { authorization: auth }, rawBody: "{}" })).toMatchObject({ ok: false, error: { code: "invalid_input" } });
    expect(await listing.authenticateBookingCall({ url: "https://salon.example/api/reserve/v3/HealthCheck", method: "GET", headers: { authorization: "Basic Z29vZ2xlOndyb25n" }, rawBody: "" })).toMatchObject({ ok: false, error: { code: "invalid_signature" } });
  });

  it("does not claim real-time updates it cannot send", async () => {
    expect(await listing.notifyAvailability({ merchant: { id: "m", name: "n", url: "https://x.example", address: { street: "s", locality: "l", postalCode: "1", country: "SE" }, timeZone: "UTC", language: "en" }, services: [], slots: [] })).toMatchObject({ ok: false, error: { code: "not_supported" } });
  });
});

describe("Meta publishing", () => {
  const TOKEN = "EAASECRETpageaccesstoken0123456789";
  const APP_SECRET = "SECRETappsecret";
  const social = (fetch: typeof globalThis.fetch) => metaSocial({ pageAccessToken: TOKEN, appSecret: APP_SECRET, pageId: "1234567890", instagramUserId: "17841400000000000", fetch, wait: async () => {} });
  const post = { caption: "Autumn offer", imageUrl: "https://salon.example/poster.jpg", reference: "c-1" };

  it("publishes to Instagram once the container is ready, with the token never in a URL", async () => {
    const { fetch, calls } = scriptedFetch({ status: 200, body: { id: "17900000000000001" } }, { status: 200, body: { status_code: "IN_PROGRESS" } }, { status: 200, body: { status_code: "FINISHED" } }, { status: 200, body: { id: "media-1" } });
    expect(await social(fetch).publish({ ...post, channel: "instagram" })).toMatchObject({ ok: true, value: { postId: "media-1" } });
    expect(calls.map((c) => new URL(c.url).pathname)).toEqual(["/v27.0/17841400000000000/media", "/v27.0/17900000000000001", "/v27.0/17900000000000001", "/v27.0/17841400000000000/media_publish"]);
    expect(calls[1].headers.authorization).toBe(`Bearer ${TOKEN}`);
    const first = Object.fromEntries(new URLSearchParams(calls[0].body));
    expect(first).toEqual({ image_url: post.imageUrl, caption: post.caption, access_token: TOKEN, appsecret_proof: createHmac("sha256", APP_SECRET).update(TOKEN).digest("hex") });
    expect(new URLSearchParams(calls[3].body).get("creation_id")).toBe("17900000000000001");
    expect(calls.every((c) => !c.url.includes(TOKEN))).toBe(true);
  });

  it("gives up on a container that never finishes, without marking it retryable", async () => {
    const pending = { status: 200, body: { status_code: "IN_PROGRESS" } };
    const { fetch, calls } = scriptedFetch({ status: 200, body: { id: "17900000000000001" } }, pending, pending, pending, pending, pending);
    expect(await social(fetch).publish({ ...post, channel: "instagram" })).toMatchObject({ ok: false, error: { code: "provider_unavailable", providerCode: "IN_PROGRESS", retryable: false } });
    expect(calls.some((c) => c.url.endsWith("/media_publish"))).toBe(false);
  });

  it("posts a Facebook Page photo", async () => {
    const { fetch, calls } = scriptedFetch({ status: 200, body: { id: "photo-1", post_id: "1234567890_99" } });
    expect(await social(fetch).publish({ ...post, channel: "facebook" })).toMatchObject({ ok: true, value: { postId: "1234567890_99" } });
    expect(Object.fromEntries(new URLSearchParams(calls[0].body))).toMatchObject({ url: post.imageUrl, caption: post.caption, published: "true" });
  });

  it.each([
    [{ error: { message: "Error validating access token", type: "OAuthException", code: 190, error_subcode: 463, fbtrace_id: "A1" } }, "unauthorized", "190.463"],
    [{ error: { message: "Application request limit reached", type: "OAuthException", code: 4 } }, "rate_limited", "4"],
    [{ error: { message: "Permissions error", type: "OAuthException", code: 200 } }, "forbidden", "200"],
    [{ error: { message: "Invalid parameter", type: "OAuthException", code: 100 } }, "invalid_input", "100"],
  ])("maps %j", async (body, code, providerCode) => {
    expect(await social(scriptedFetch({ status: 400, body }).fetch).publish({ ...post, channel: "instagram" })).toMatchObject({ ok: false, error: { code, providerCode } });
  });

  it("verifies X-Hub-Signature-256 and computes appsecret_proof", () => {
    const raw = '{"object":"page","entry":[]}';
    const header = `sha256=${createHmac("sha256", APP_SECRET).update(raw).digest("hex")}`;
    expect(verifyMetaSignature(APP_SECRET, header, raw)).toBe(true);
    expect(verifyMetaSignature(APP_SECRET, header, raw.replace("page", "user"))).toBe(false);
    expect(verifyMetaSignature(APP_SECRET, undefined, raw)).toBe(false);
    expect(appSecretProof(TOKEN, APP_SECRET)).toMatch(/^[0-9a-f]{64}$/);
  });
});
