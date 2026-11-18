// Shared contract for every connection port (SMS, email, payments, ...).
// Browser-safe: no Node imports, no environment reads, no network.
//
// Locale-neutral by design: money is integer minor units plus an ISO 4217
// currency, phone numbers are E.164, timestamps are UTC ISO 8601 plus an IANA
// time zone where wall-clock time matters, countries are ISO 3166-1 alpha-2
// and languages are BCP 47 tags.

export const PORTS = ["sms", "email", "payments", "accounting", "calendar", "listing", "social", "ads"] as const;
export type PortName = (typeof PORTS)[number];

/** Integer minor units (cents, öre, pence) plus an ISO 4217 code, e.g. { amountMinor: 4900, currency: "SEK" }. */
export interface Money {
  amountMinor: number;
  currency: string;
}

/** E.164, e.g. "+46701234567". */
export type PhoneE164 = string;
/** UTC ISO 8601 with a trailing Z, e.g. "2026-11-18T09:30:00Z". */
export type UtcTimestamp = string;
/** IANA zone, e.g. "Europe/Stockholm" or "America/New_York". */
export type TimeZone = string;
/** ISO 3166-1 alpha-2, e.g. "SE", "US". */
export type CountryCode = string;
/** BCP 47, e.g. "en", "sv-SE". */
export type LanguageTag = string;

/** Where a send stands. `simulated` means it was recorded and never left the process. */
export type DeliveryStatus = "simulated" | "queued" | "sent" | "delivered" | "failed";

/** Normalised error codes. Adapters map provider responses to these. */
export const ERROR_CODES = [
  "invalid_input",
  "unauthorized",
  "forbidden",
  "not_found",
  "conflict",
  "rejected",
  "rate_limited",
  "provider_unavailable",
  "timeout",
  "network",
  "not_configured",
  "not_supported",
  "invalid_signature",
  "unknown",
] as const;
export type ConnectionErrorCode = (typeof ERROR_CODES)[number];

const MESSAGES: Record<ConnectionErrorCode, string> = {
  invalid_input: "The request did not pass validation.",
  unauthorized: "The provider rejected the credentials.",
  forbidden: "The account lacks permission or approval for this action.",
  not_found: "The provider could not find the resource.",
  conflict: "The provider reported a conflict or duplicate.",
  rejected: "The provider declined the request.",
  rate_limited: "The provider asked us to slow down.",
  provider_unavailable: "The provider is unavailable.",
  timeout: "The provider did not answer in time.",
  network: "The provider could not be reached.",
  not_configured: "This connection is not configured.",
  not_supported: "This provider does not support the action.",
  invalid_signature: "The webhook signature did not verify.",
  unknown: "The provider returned an unexpected response.",
};

const RETRYABLE = new Set<ConnectionErrorCode>(["rate_limited", "provider_unavailable", "timeout", "network"]);

/**
 * A normalised failure. `message` is always one of our fixed texts, never the
 * provider's (provider messages can echo request data). `providerCode` keeps a
 * short, sanitised provider error code for support.
 */
export interface ConnectionError {
  code: ConnectionErrorCode;
  message: string;
  port: PortName;
  provider: string;
  retryable: boolean;
  httpStatus?: number;
  retryAfterSeconds?: number;
  providerCode?: string;
}

const SAFE_CODE = /^[A-Za-z0-9_.-]{1,48}$/;

export function connectionError(
  port: PortName,
  provider: string,
  code: ConnectionErrorCode,
  extra: { httpStatus?: number; retryAfterSeconds?: number; providerCode?: unknown } = {},
): ConnectionError {
  const providerCode = extra.providerCode === undefined || extra.providerCode === null ? undefined : String(extra.providerCode);
  return {
    code,
    message: MESSAGES[code],
    port,
    provider,
    retryable: RETRYABLE.has(code),
    ...(extra.httpStatus !== undefined ? { httpStatus: extra.httpStatus } : {}),
    ...(extra.retryAfterSeconds !== undefined ? { retryAfterSeconds: extra.retryAfterSeconds } : {}),
    ...(providerCode && SAFE_CODE.test(providerCode) ? { providerCode } : {}),
  };
}

/** Every port call resolves to this; adapters never throw for provider failures. */
export type PortResult<T> =
  | { ok: true; value: T; status: DeliveryStatus; providerId?: string; cost: Money | null }
  | { ok: false; error: ConnectionError };

export function ok<T>(value: T, status: DeliveryStatus, cost: Money | null = null, providerId?: string): PortResult<T> {
  return { ok: true, value, status, cost, ...(providerId ? { providerId } : {}) };
}

export function fail<T = never>(error: ConnectionError): PortResult<T> {
  return { ok: false, error };
}

/** What an adapter can do. The registry and the settings page read these instead of guessing. */
export interface AdapterInfo<C extends string = string> {
  port: PortName;
  /** Stable id, e.g. "twilio", "simulated". */
  provider: string;
  /** "simulated": deterministic, never leaves the process. "live": calls the provider. "interface": contract only, every call returns not_supported. */
  kind: "simulated" | "live" | "interface";
  capabilities: readonly C[];
  /** Region label for regional adapters (docs and settings grouping), e.g. "Nordics". Absent for global ones. */
  region?: string;
  /** Secret names the adapter reads through the secret store. */
  secrets: readonly string[];
}

export interface Adapter<C extends string = string> {
  readonly info: AdapterInfo<C>;
}

// Validation shared by adapters. Live adapters must validate before any request.

const E164 = /^\+[1-9]\d{6,14}$/;
const ISO_CURRENCY = /^[A-Z]{3}$/;
const ISO_COUNTRY = /^[A-Z]{2}$/;
const EMAIL = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]+$/;
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?Z$/;
const BCP47 = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;

export const isE164 = (value: string): boolean => E164.test(value);
export const isEmail = (value: string): boolean => value.length <= 254 && EMAIL.test(value);
export const isCurrency = (value: string): boolean => ISO_CURRENCY.test(value);
export const isCountry = (value: string): boolean => ISO_COUNTRY.test(value);
export const isUtc = (value: string): boolean => UTC.test(value) && !Number.isNaN(Date.parse(value));
export const isLanguageTag = (value: string): boolean => BCP47.test(value);
export const isMoney = (value: Money): boolean => Number.isSafeInteger(value.amountMinor) && value.amountMinor >= 0 && isCurrency(value.currency);
export function isTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value });
    return value.includes("/") || value === "UTC";
  } catch {
    return false;
  }
}

/** A recipient reference the simulated adapters accept in place of an address, e.g. "customer:c-12" or "segment:waitlist". Live adapters refuse it. */
export const isRecipientRef = (value: string): boolean => /^(customer|segment):[A-Za-z0-9_-]{1,64}$/.test(value);

/** Short, stable hash for deterministic simulated ids (FNV-1a, 32 bit). Not for security. */
export function stableHash(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).padStart(7, "0");
}

/** Digits after the decimal point for an ISO 4217 currency (2 for EUR, 0 for JPY). */
export function minorDigits(currency: string): number {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

/**
 * A provider's decimal amount in major units ("-0.0646", 12.5) as Money.
 * Sign is dropped (providers report charges as negative) and fractions of a
 * minor unit are rounded up, so a cost is never under-reported. Null when unknown.
 */
export function moneyFromMajor(amount: unknown, currency: unknown): Money | null {
  if (typeof currency !== "string" || !isCurrency(currency.toUpperCase())) return null;
  const value = typeof amount === "string" ? Number(amount) : amount;
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const code = currency.toUpperCase();
  const minor = Math.abs(value) * 10 ** minorDigits(code);
  return { amountMinor: Math.ceil(Number(minor.toFixed(6))), currency: code };
}

/** Money as a provider's decimal string in major units, e.g. { 12345, "SEK" } -> "123.45". */
export function majorString(money: Money): string {
  const digits = minorDigits(money.currency);
  return digits === 0 ? String(money.amountMinor) : (money.amountMinor / 10 ** digits).toFixed(digits);
}
