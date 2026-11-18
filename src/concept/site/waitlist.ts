// The launch waiting list behind POST /api/waitlist: validation, a small
// in-memory rate limit and a provider adapter. The default provider, "none",
// is honest: it stores nothing and says so. Nothing here ever logs an address.

export const WAITLIST_PROVIDERS = ["none", "resend", "buttondown", "loops", "postgres"] as const;
export type WaitlistProvider = (typeof WAITLIST_PROVIDERS)[number];

export const BUSINESS_KINDS = ["salon", "clinic", "other"] as const;
export type BusinessKind = (typeof BUSINESS_KINDS)[number];

export interface WaitlistEntry {
  email: string;
  business?: BusinessKind;
}

/**
 * What the visitor is told. "not-open": nothing was stored (no provider yet); "added": a provider stored the
 * address; "invalid": the address is unusable; "limited": too many tries from this address.
 */
export type WaitlistOutcome = "not-open" | "added" | "invalid" | "limited";
export const WAITLIST_OUTCOMES: readonly WaitlistOutcome[] = ["not-open", "added", "invalid", "limited"];

/** RFC 5321 caps an address at 254 characters. */
export const EMAIL_MAX = 254;
const EMAIL = /^[^\s@<>(),;:"]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i;

/** The honeypot: a field people never see or fill in. */
export const HONEYPOT_FIELD = "website";

export type WaitlistInput = { ok: true; entry: WaitlistEntry } | { ok: false; reason: "invalid" | "bot" };

/** Reads a submission (JSON body or form fields). Anything but strings is refused; an unknown business kind is dropped. */
export function parseWaitlistInput(raw: unknown): WaitlistInput {
  if (!raw || typeof raw !== "object") return { ok: false, reason: "invalid" };
  const fields = raw as Record<string, unknown>;
  if (typeof fields[HONEYPOT_FIELD] === "string" && fields[HONEYPOT_FIELD].trim()) return { ok: false, reason: "bot" };
  const email = typeof fields.email === "string" ? fields.email.trim() : "";
  if (!email || email.length > EMAIL_MAX || !EMAIL.test(email) || email.includes("..")) return { ok: false, reason: "invalid" };
  const business = BUSINESS_KINDS.find((kind) => kind === fields.business);
  return { ok: true, entry: { email: email.toLowerCase(), business } };
}

/** The configured provider; unset or unknown means "none". Keys for real providers are read from the environment only. */
export function waitlistProvider(env: Record<string, string | undefined> = process.env): WaitlistProvider {
  const wanted = (env.WAITLIST_PROVIDER ?? "").trim().toLowerCase();
  return WAITLIST_PROVIDERS.find((provider) => provider === wanted) ?? "none";
}

type Adapter = (entry: WaitlistEntry) => Promise<Extract<WaitlistOutcome, "not-open" | "added">>;

/** Stores nothing and never claims it did. */
const none: Adapter = async () => "not-open";

/**
 * One adapter per provider. Only "none" exists so far (docs/WAITLIST.md compares the others);
 * a provider that is named but not built behaves like "none", so the page can never claim an address was saved.
 */
const ADAPTERS: Partial<Record<WaitlistProvider, Adapter>> = { none };

export function joinWaitlist(entry: WaitlistEntry, provider: WaitlistProvider = waitlistProvider()): Promise<Extract<WaitlistOutcome, "not-open" | "added">> {
  return (ADAPTERS[provider] ?? none)(entry);
}

export const RATE_LIMIT = { max: 5, windowMs: 10 * 60 * 1000 };
const MAX_TRACKED = 5000;

/** A fixed-window counter per client, kept in memory: enough to slow a script down, gone on restart. */
export function createRateLimiter({ max, windowMs } = RATE_LIMIT) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (key: string, now = Date.now()): boolean => {
    const current = hits.get(key);
    if (!current || current.resetAt <= now) {
      if (hits.size >= MAX_TRACKED) for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
      if (hits.size >= MAX_TRACKED) hits.clear();
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    current.count += 1;
    return current.count <= max;
  };
}

/** The pages that carry the form; a form post without JavaScript is sent back to one of them. */
export const WAITLIST_PAGES = ["/", "/coming-soon", "/landing"] as const;
