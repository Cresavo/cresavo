import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// The signed page token. The /studio/ring page is rendered with one; the call
// route refuses a request without a valid, unexpired one. It is not a login:
// it makes the call route impossible to use without first loading the page,
// and it names the page session the per-session limit counts against.

type Env = Record<string, string | undefined>;

/** How long a rendered page can start calls. */
export const PAGE_TOKEN_SECONDS = 20 * 60;
const VERSION = "w1";
const CONTEXT = "cresavo:receptionist-web-call:";

/** `PHONE_RECEPTIONIST_TOKEN_SECRET`, else the deployment's `SESSION_SECRET`; at least 32 characters, or null. */
export function tokenSecret(env: Env = process.env): string | null {
  const secret = env.PHONE_RECEPTIONIST_TOKEN_SECRET || env.SESSION_SECRET;
  return secret && secret.length >= 32 ? secret : null;
}

const sign = (secret: string, payload: string) => createHmac("sha256", secret).update(CONTEXT + payload).digest("base64url");

export interface PageToken {
  token: string;
  /** The page session: random, never shown. */
  session: string;
  /** Epoch seconds. */
  expiresAt: number;
}

export function issuePageToken(secret: string, now = Date.now()): PageToken {
  const session = randomBytes(16).toString("base64url");
  const expiresAt = Math.floor(now / 1000) + PAGE_TOKEN_SECONDS;
  const payload = `${VERSION}.${session}.${expiresAt}`;
  return { token: `${payload}.${sign(secret, payload)}`, session, expiresAt };
}

export type TokenCheck = { ok: true; session: string } | { ok: false; reason: "invalid" } | { ok: false; reason: "expired"; session: string };

export function verifyPageToken(secret: string, token: unknown, now = Date.now()): TokenCheck {
  if (typeof token !== "string" || token.length > 200) return { ok: false, reason: "invalid" };
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION || !/^[\w-]{22}$/.test(parts[1]) || !/^\d{10}$/.test(parts[2])) return { ok: false, reason: "invalid" };
  const expected = Buffer.from(sign(secret, parts.slice(0, 3).join(".")));
  const given = Buffer.from(parts[3]);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return { ok: false, reason: "invalid" };
  const expiresAt = Number(parts[2]);
  const seconds = Math.floor(now / 1000);
  // A token from the future (longer than one lifetime ahead) was not made here.
  if (expiresAt > seconds + PAGE_TOKEN_SECONDS + 60) return { ok: false, reason: "invalid" };
  if (expiresAt <= seconds) return { ok: false, reason: "expired", session: parts[1] };
  return { ok: true, session: parts[1] };
}
