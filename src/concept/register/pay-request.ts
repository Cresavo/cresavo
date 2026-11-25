import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { demoPayments } from "../connections/demo";
import { isCurrency } from "../connections/core";
import { swishEligible } from "../connections/ports/payments";
import { salonWith } from "../packs/base";
import { demoRegisterAllowed, type RegisterContext } from "./factory";

// The demo register's "pay on your phone" request. The register lives in the
// owner's browser, so the customer's phone reaches it through the server: the
// register asks for a short-lived request, shows it as a QR code and polls
// until the phone has paid it. Nothing here moves money.
//
// The request itself is stateless: a signed token that carries the amount,
// the currency, the allowed methods, the demo business and its expiry, and
// nothing about the customer or the booking. Only "this request was paid, by
// card or Swish" is kept, in a bounded map in process memory until the request
// has expired. When the map is full, new requests and payments are refused
// until marks expire; an unexpired mark is never dropped, so a paid request
// cannot be paid again on this instance.
//
// Known limit, accepted for the demo (docs/QUALITY_SECURITY.md): server
// instances share no state. Behind more than one instance
// - a request is paid once per instance, not once overall;
// - the register sees a payment only when a poll reaches the instance that
//   took it, and may show the code as expired after the phone has paid;
// - without `SESSION_SECRET` each instance signs with its own key, so another
//   instance cannot read the request at all (404) and the register asks for a
//   new code.
// A real phone payment needs the payment provider's own state, not this map.

export const PAY_REQUEST_TTL_MS = 10 * 60_000;
/** A paid mark outlives its request a little, so a register polling at the very end still sees it. */
const PAID_GRACE_MS = 2 * 60_000;
const MAX_PAID = 5000;
const MAX_AMOUNT_MINOR = 15_000_000;

export type PhoneMethod = "card" | "swish";
const METHOD_CODES: Record<string, PhoneMethod> = { c: "card", s: "swish" };

export interface PayRequest {
  id: string;
  amountMinor: number;
  currency: string;
  methods: PhoneMethod[];
  business: string;
  /** Epoch milliseconds, whole seconds. */
  expiresAt: number;
}

export type PayRequestStatus = { status: "pending" } | { status: "paid"; method: PhoneMethod } | { status: "expired" };

interface Vault {
  secret?: Buffer;
  paid: Map<string, { method: PhoneMethod; until: number }>;
}

// Each route is its own bundle, so the map hangs on the process, not on this module.
const VAULT = Symbol.for("cresavo.register.pay-requests");
function vault(): Vault {
  const holder = globalThis as { [VAULT]?: Vault };
  return (holder[VAULT] ??= { paid: new Map() });
}

/** Clears the paid marks and the per-process key. For tests. */
export function resetPayRequests() {
  delete (globalThis as { [VAULT]?: Vault })[VAULT];
}

/**
 * The signing key: derived from the deployment's session secret when it has
 * one, so every instance accepts the same requests; otherwise random per
 * process. Never logged, never sent.
 */
function signingKey(): Buffer {
  const shared = process.env.SESSION_SECRET;
  if (shared && shared.length >= 32) return createHmac("sha256", shared).update("cresavo:register-pay-request:v1").digest();
  const store = vault();
  return (store.secret ??= randomBytes(32));
}

const sign = (body: string) => createHmac("sha256", signingKey()).update(body).digest().subarray(0, 16).toString("base64url");

/** The demo businesses the server knows by name: the sample salon of the fixtures. */
const DEMO_BUSINESSES: Record<string, string> = Object.fromEntries([salonWith("")].map((salon) => [salon.slug, salon.name]));

export const demoBusinessName = (business: string): string | undefined => (Object.hasOwn(DEMO_BUSINESSES, business) ? DEMO_BUSINESSES[business] : undefined);

export interface PayRequestInput {
  business: string;
  workspace: RegisterContext["workspace"];
  amountMinor: number;
  currency: string;
  methods: PhoneMethod[];
}

export type IssueResult = { ok: true; token: string; request: PayRequest } | { ok: false; reason: "not_demo" | "invalid" | "busy" };

/**
 * A new request for the demo register. Refused for anything but the sample
 * business on simulated payments (the register's own guard), so a real
 * business can never show a customer this page.
 */
export function issuePayRequest(input: PayRequestInput, now = Date.now()): IssueResult {
  if (!demoRegisterAllowed({ workspace: input.workspace, payments: demoPayments }) || input.workspace !== "demo" || !demoBusinessName(input.business)) {
    return { ok: false, reason: "not_demo" };
  }
  const methods = (["card", "swish"] as const).filter((method) => input.methods.includes(method));
  const valid = Number.isSafeInteger(input.amountMinor) && input.amountMinor > 0 && input.amountMinor <= MAX_AMOUNT_MINOR && isCurrency(input.currency) &&
    methods.length > 0 && methods.length === input.methods.length &&
    (!methods.includes("swish") || swishEligible({ amountMinor: input.amountMinor, currency: input.currency }));
  if (!valid) return { ok: false, reason: "invalid" };
  if (full(now)) return { ok: false, reason: "busy" };
  const request: PayRequest = {
    id: randomBytes(9).toString("base64url"), amountMinor: input.amountMinor, currency: input.currency, methods, business: input.business,
    expiresAt: (Math.floor(now / 1000) + PAY_REQUEST_TTL_MS / 1000) * 1000,
  };
  const body = [request.id, request.amountMinor, request.currency, methods.map((m) => m[0]).join(""), request.business, request.expiresAt / 1000].join(".");
  return { ok: true, token: `${body}.${sign(body)}`, request };
}

const TOKEN = /^([\w-]{12})\.([1-9]\d{0,8})\.([A-Z]{3})\.(c|s|cs)\.([a-z0-9-]{1,40})\.(\d{10})\.([\w-]{22})$/;

/** The request a token carries, or null when the token is not one this deployment signed. Expiry is the caller's question. */
export function readPayRequest(token: string): PayRequest | null {
  const match = TOKEN.exec(token);
  if (!match) return null;
  const [, id, amount, currency, methods, business, expires, signature] = match;
  const expected = Buffer.from(sign(token.slice(0, token.lastIndexOf("."))));
  const given = Buffer.from(signature);
  if (given.length !== expected.length || !timingSafeEqual(given, expected) || !demoBusinessName(business)) return null;
  return { id, amountMinor: Number(amount), currency, methods: [...methods].map((code) => METHOD_CODES[code]), business, expiresAt: Number(expires) * 1000 };
}

function sweep(paid: Vault["paid"], now: number) {
  for (const [id, mark] of paid) if (mark.until <= now) paid.delete(id);
}

/** True when no more paid marks fit until some expire. */
function full(now: number) {
  const { paid } = vault();
  sweep(paid, now);
  return paid.size >= MAX_PAID;
}

export function payRequestStatus(request: PayRequest, now = Date.now()): PayRequestStatus {
  const { paid } = vault();
  sweep(paid, now);
  const mark = paid.get(request.id);
  if (mark) return { status: "paid", method: mark.method };
  return now >= request.expiresAt ? { status: "expired" } : { status: "pending" };
}

export type PayOutcome = "paid" | "already_paid" | "expired" | "method_not_allowed" | "busy";

/**
 * Pays a request once. A second attempt, an expired request or a method the
 * register did not offer is refused, and so is any payment while the paid
 * marks are full (`busy`): evicting one would let its request be paid again.
 */
export function payPayRequest(request: PayRequest, method: string, now = Date.now()): PayOutcome {
  const { paid } = vault();
  sweep(paid, now);
  if (paid.has(request.id)) return "already_paid";
  if (now >= request.expiresAt) return "expired";
  if (!request.methods.includes(method as PhoneMethod)) return "method_not_allowed";
  if (paid.size >= MAX_PAID) return "busy";
  paid.set(request.id, { method: method as PhoneMethod, until: request.expiresAt + PAID_GRACE_MS });
  return "paid";
}
