import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as create } from "@/app/api/concept/register/pay-requests/route";
import { GET as status } from "@/app/api/concept/register/pay-requests/[token]/route";
import { POST as pay } from "@/app/api/concept/register/pay-requests/[token]/pay/route";
import { demoRegister } from "@/concept/connections/simulated/register";
import { issuePayRequest, PAY_REQUEST_TTL_MS, payPayRequest, payRequestStatus, readPayRequest, resetPayRequests } from "@/concept/register/pay-request";
import { publicReadonlyResponse } from "@/lib/public-readonly";

// The demo register's "pay on your phone" request: a signed, short-lived, single-use
// request that carries an amount and the sample business, never a customer. Invented data.

const input = { business: "salong-eko", workspace: "demo" as const, amountMinor: 79500, currency: "SEK", methods: ["card", "swish"] as ("card" | "swish")[] };
const now = Date.UTC(2026, 10, 25, 10, 0, 0);
const BASE = "http://localhost/api/concept/register/pay-requests";
const sameOrigin = { "content-type": "application/json", host: "localhost", origin: "http://localhost", "sec-fetch-site": "same-origin" };
const context = (token: string) => ({ params: Promise.resolve({ token }) });
const postCreate = (body: unknown, headers: Record<string, string> = sameOrigin) =>
  create(new Request(BASE, { method: "POST", headers, body: JSON.stringify(body) }), {});
const postPay = (token: string, method: string, headers: Record<string, string> = sameOrigin) =>
  pay(new Request(`${BASE}/${token}/pay`, { method: "POST", headers, body: JSON.stringify({ method }) }), context(token));
const getStatus = (token: string, headers: Record<string, string> = sameOrigin) => status(new Request(`${BASE}/${token}`, { headers }), context(token));

beforeEach(() => {
  resetPayRequests();
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("pay request token", () => {
  it("carries the amount, currency, methods, business and expiry, and nothing else", () => {
    const issued = issuePayRequest(input, now);
    if (!issued.ok) throw new Error("refused");
    const fields = issued.token.split(".");
    expect(fields).toHaveLength(7);
    expect(fields.slice(1, 6)).toEqual(["79500", "SEK", "cs", "salong-eko", String((now + PAY_REQUEST_TTL_MS) / 1000)]);
    expect(fields[0]).toMatch(/^[\w-]{12}$/);
    expect(readPayRequest(issued.token)).toEqual(issued.request);
    expect(Object.keys(issued.request).sort()).toEqual(["amountMinor", "business", "currency", "expiresAt", "id", "methods"]);
  });

  it("has no field for a customer, a booking or a treatment in the request body", async () => {
    for (const extra of [{ customer: "c-1" }, { name: "Invented Person" }, { reference: "b-1" }, { description: "Haircut" }]) {
      expect((await postCreate({ ...input, ...extra })).status).toBe(400);
    }
  });

  it("refuses a changed or foreign token", () => {
    vi.stubEnv("SESSION_SECRET", "");
    const issued = issuePayRequest(input, now);
    if (!issued.ok) throw new Error("refused");
    expect(readPayRequest(issued.token.replace(".79500.", ".100."))).toBeNull();
    expect(readPayRequest(issued.token.replace(".cs.", ".c."))).toBeNull();
    expect(readPayRequest(issued.token.slice(0, -1) + (issued.token.endsWith("A") ? "B" : "A"))).toBeNull();
    expect(readPayRequest("not-a-token")).toBeNull();
    resetPayRequests();
    expect(readPayRequest(issued.token)).toBeNull();
  });

  it("is accepted by every instance that shares the session secret", () => {
    vi.stubEnv("SESSION_SECRET", "an-invented-test-secret-of-32-chars!");
    const issued = issuePayRequest(input, now);
    if (!issued.ok) throw new Error("refused");
    resetPayRequests();
    expect(readPayRequest(issued.token)).toEqual(issued.request);
    expect(issued.token).not.toContain("an-invented");
  });

  it("expires after ten minutes", () => {
    const issued = issuePayRequest(input, now);
    if (!issued.ok) throw new Error("refused");
    expect(issued.request.expiresAt - now).toBe(10 * 60_000);
    expect(payRequestStatus(issued.request, issued.request.expiresAt - 1)).toEqual({ status: "pending" });
    expect(payRequestStatus(issued.request, issued.request.expiresAt)).toEqual({ status: "expired" });
    expect(payPayRequest(issued.request, "card", issued.request.expiresAt)).toBe("expired");
    expect(payRequestStatus(issued.request, issued.request.expiresAt)).toEqual({ status: "expired" });
  });

  it("is paid once, with a method the register offered", () => {
    const issued = issuePayRequest({ ...input, methods: ["card"] }, now);
    if (!issued.ok) throw new Error("refused");
    expect(payPayRequest(issued.request, "swish", now)).toBe("method_not_allowed");
    expect(payPayRequest(issued.request, "cash", now)).toBe("method_not_allowed");
    expect(payPayRequest(issued.request, "card", now)).toBe("paid");
    expect(payPayRequest(issued.request, "card", now)).toBe("already_paid");
    expect(payRequestStatus(issued.request, now)).toEqual({ status: "paid", method: "card" });
    // Still paid for a register that asks just after the expiry, then forgotten.
    expect(payRequestStatus(issued.request, issued.request.expiresAt + 1000)).toEqual({ status: "paid", method: "card" });
    expect(payRequestStatus(issued.request, issued.request.expiresAt + 3 * 60_000)).toEqual({ status: "expired" });
  });

  it("refuses new requests and payments while the paid marks are full, and never drops an unexpired one", () => {
    const requests = Array.from({ length: 5001 }, () => {
      const issued = issuePayRequest(input, now);
      if (!issued.ok) throw new Error("refused");
      return issued.request;
    });
    for (const request of requests.slice(0, 5000)) expect(payPayRequest(request, "card", now)).toBe("paid");
    expect(payPayRequest(requests[5000], "card", now)).toBe("busy");
    expect(issuePayRequest(input, now)).toEqual({ ok: false, reason: "busy" });
    // The oldest mark is still there, so that request cannot be paid again.
    expect(payPayRequest(requests[0], "card", now)).toBe("already_paid");
    expect(payRequestStatus(requests[0], now)).toEqual({ status: "paid", method: "card" });
    // Once the marks have expired there is room again.
    const later = requests[0].expiresAt + 3 * 60_000;
    expect(issuePayRequest(input, later).ok).toBe(true);
  });

  it("is refused for anything but the sample business on simulated payments", () => {
    expect(issuePayRequest({ ...input, workspace: "account" }, now)).toEqual({ ok: false, reason: "not_demo" });
    expect(issuePayRequest({ ...input, workspace: "own" }, now)).toEqual({ ok: false, reason: "not_demo" });
    expect(issuePayRequest({ ...input, business: "another-salon" }, now)).toEqual({ ok: false, reason: "not_demo" });
    expect(issuePayRequest({ ...input, business: "constructor" }, now)).toEqual({ ok: false, reason: "not_demo" });
  });

  it("refuses amounts and methods that make no sense", () => {
    for (const amountMinor of [0, -1, 1.5, 15_000_001]) expect(issuePayRequest({ ...input, amountMinor }, now).ok).toBe(false);
    expect(issuePayRequest({ ...input, currency: "sek" }, now).ok).toBe(false);
    expect(issuePayRequest({ ...input, methods: [] }, now).ok).toBe(false);
    expect(issuePayRequest({ ...input, methods: ["card", "card"] }, now).ok).toBe(false);
    // Swish takes SEK from 3 kr.
    expect(issuePayRequest({ ...input, amountMinor: 200 }, now).ok).toBe(false);
    expect(issuePayRequest({ ...input, currency: "EUR" }, now).ok).toBe(false);
    expect(issuePayRequest({ ...input, currency: "EUR", methods: ["card"] }, now).ok).toBe(true);
  });
});

describe("pay request routes", () => {
  it("creates, reports and pays a request once", async () => {
    const created = await postCreate(input);
    expect(created.status).toBe(201);
    expect(created.headers.get("Cache-Control")).toBe("no-store");
    const { token, expiresAt } = await created.json();
    expect(expiresAt).toBeGreaterThan(Date.now());
    expect(await (await getStatus(token)).json()).toEqual({ status: "pending" });
    const paid = await postPay(token, "swish");
    expect(paid.status).toBe(200);
    expect(await (await getStatus(token)).json()).toEqual({ status: "paid", method: "swish" });
    expect((await postPay(token, "swish")).status).toBe(409);
    expect((await postPay(token, "card")).status).toBe(409);
  });

  it("refuses an expired request", async () => {
    vi.useFakeTimers({ now });
    const { token } = await (await postCreate(input)).json();
    vi.setSystemTime(now + PAY_REQUEST_TTL_MS);
    expect((await postPay(token, "card")).status).toBe(410);
    expect(await (await getStatus(token)).json()).toEqual({ status: "expired" });
  });

  it("refuses another business, an owner account and a trial salon", async () => {
    expect((await postCreate({ ...input, business: "another-salon" })).status).toBe(403);
    expect((await postCreate({ ...input, workspace: "account" })).status).toBe(403);
    expect((await postCreate({ ...input, workspace: "own" })).status).toBe(403);
  });

  it("refuses other sites, unknown tokens and bad input", async () => {
    const elsewhere = { ...sameOrigin, origin: "https://elsewhere.example", "sec-fetch-site": "cross-site" };
    expect((await postCreate(input, elsewhere)).status).toBe(403);
    const { token } = await (await postCreate(input)).json();
    expect((await postPay(token, "card", elsewhere)).status).toBe(403);
    expect((await getStatus(token, elsewhere)).status).toBe(403);
    expect((await postPay(token, "cash")).status).toBe(400);
    expect((await postPay("not-a-token", "card")).status).toBe(404);
    expect((await getStatus("not-a-token")).status).toBe(404);
    expect((await postCreate("{")).status).toBe(400);
    expect((await postCreate({ ...input, amountMinor: "79500" })).status).toBe(400);
  });
});

describe("read-only demo", () => {
  it("opens exactly the two pay-request writes", () => {
    vi.stubEnv("PUBLIC_READONLY", "1");
    const refused = (method: string, path: string) => publicReadonlyResponse(new Request(`http://localhost${path}`, { method }))?.status;
    const token = "AbCdEfGhIjKl.79500.SEK.cs.salong-eko.1795600000.AbCdEfGhIjKlMnOpQrStUv";
    expect(refused("POST", "/api/concept/register/pay-requests")).toBeUndefined();
    expect(refused("POST", `/api/concept/register/pay-requests/${token}/pay`)).toBeUndefined();
    expect(refused("GET", `/api/concept/register/pay-requests/${token}`)).toBeUndefined();
    for (const method of ["PUT", "PATCH", "DELETE"]) {
      expect(refused(method, "/api/concept/register/pay-requests")).toBe(403);
      expect(refused(method, `/api/concept/register/pay-requests/${token}/pay`)).toBe(403);
    }
    for (const path of [
      "/api/concept/register", "/api/concept/register/other", "/api/concept/register/pay-requests/extra/more/pay",
      `/api/concept/register/pay-requests/${token}`, `/api/concept/register/pay-requests/${token}/refund`,
      "/api/concept/register/pay-requests/../../admin/pay", "/api/concept/registers/pay-requests", "/api/v1/register/pay-requests",
    ]) expect(refused("POST", path), path).toBe(403);
  });

  it("still serves the routes with the flag on", async () => {
    vi.stubEnv("PUBLIC_READONLY", "1");
    const created = await postCreate(input);
    expect(created.status).toBe(201);
    const { token } = await created.json();
    expect((await postPay(token, "card")).status).toBe(200);
  });
});

describe("register confirms a phone payment", () => {
  it("issues the receipt with the method the customer chose", async () => {
    const register = demoRegister();
    const sale = await register.startSale({ business: "salong-eko", reference: "b-1", currency: "SEK", date: "2026-11-25", prepaidMinor: 0, idempotencyKey: "k-sale", lines: [{ description: "Haircut", grossMinor: 79500, vatRatePercent: 25 }] });
    if (!sale.ok) throw new Error("no sale");
    const started = await register.recordPayment({ saleId: sale.value.id, method: "card", amountMinor: 79500, pending: true, at: "2026-11-25T10:00:00Z", idempotencyKey: "k-pay" });
    if (!started.ok) throw new Error("no payment");
    expect(started.value.receipt).toBeUndefined();
    expect((await register.completePayment({ paymentId: started.value.payment.id, outcome: "paid", method: "cash" as never, at: "2026-11-25T10:01:00Z" })).ok).toBe(false);
    const confirmed = await register.completePayment({ paymentId: started.value.payment.id, outcome: "paid", method: "swish", at: "2026-11-25T10:01:00Z" });
    if (!confirmed.ok) throw new Error("not confirmed");
    expect(confirmed.value.receipt).toMatchObject({ method: "swish", paidMinor: 79500, register: "demo", receiptNumber: "DEMO-20261125-0001" });
    expect(confirmed.value.payment).toMatchObject({ method: "swish", state: "completed" });
  });

  it("opens the sale again when the phone payment is cancelled", async () => {
    const register = demoRegister();
    const sale = await register.startSale({ business: "salong-eko", reference: "b-2", currency: "SEK", date: "2026-11-25", prepaidMinor: 0, idempotencyKey: "k-sale", lines: [{ description: "Haircut", grossMinor: 79500, vatRatePercent: 25 }] });
    if (!sale.ok) throw new Error("no sale");
    const started = await register.recordPayment({ saleId: sale.value.id, method: "card", amountMinor: 79500, pending: true, at: "2026-11-25T10:00:00Z", idempotencyKey: "k-pay" });
    if (!started.ok) throw new Error("no payment");
    await register.completePayment({ paymentId: started.value.payment.id, outcome: "failed", at: "2026-11-25T10:01:00Z" });
    const cash = await register.recordPayment({ saleId: sale.value.id, method: "cash", amountMinor: 79500, tenderedMinor: 80000, at: "2026-11-25T10:02:00Z", idempotencyKey: "k-cash" });
    expect(cash.ok && cash.value.receipt?.method).toBe("cash");
  });
});

// Last: it uses up this address's allowance for creating requests.
describe("pay request limits", () => {
  it("limits how many requests one address creates", async () => {
    let last = 201;
    for (let i = 0; i < 40 && last === 201; i++) last = (await postCreate(input)).status;
    expect(last).toBe(429);
  });
});
