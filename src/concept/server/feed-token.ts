import { createHmac, timingSafeEqual } from "node:crypto";

// Calendar feeds are read by Google or Apple Calendar, which cannot log in, so
// the URL itself carries a secret token: an HMAC of the staff id under
// CONCEPT_ICS_SECRET. Each person's token only opens their own feed. Outside
// production a documented development secret is used when the variable is
// unset; production refuses every feed until it is set. Not owner
// authentication: that belongs to the pilot gate (docs/QUALITY_SECURITY.md).

export const DEV_ICS_SECRET = "flerdo-dev-calendar-secret";
const MIN_LENGTH = 16;

type Env = Record<string, string | undefined>;

export type FeedSecretSource = "env" | "dev-default" | "missing";

export function feedSecretSource(env: Env = process.env): FeedSecretSource {
  const configured = env.CONCEPT_ICS_SECRET?.trim();
  if (configured && configured.length >= MIN_LENGTH) return "env";
  return env.NODE_ENV === "production" ? "missing" : "dev-default";
}

function secretFor(env: Env): string | null {
  const source = feedSecretSource(env);
  if (source === "missing") return null;
  return source === "env" ? env.CONCEPT_ICS_SECRET!.trim() : DEV_ICS_SECRET;
}

const sign = (secret: string, staffId: string) => createHmac("sha256", secret).update(`ics:${staffId}`).digest("base64url");

/** The token for a person's feed, or null while feeds are closed (production without a secret). */
export function feedToken(staffId: string, env: Env = process.env): string | null {
  const secret = secretFor(env);
  return secret ? sign(secret, staffId) : null;
}

/** Constant-time check of a token against the person's expected one. */
export function validFeedToken(staffId: string, token: string | null, env: Env = process.env): boolean {
  const expected = feedToken(staffId, env);
  if (!expected || !token) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
