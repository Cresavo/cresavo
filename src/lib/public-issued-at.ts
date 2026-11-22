import { createHmac, timingSafeEqual } from "node:crypto";

// The form-time token of the public booking page: when the page was served,
// signed for one salon (its immutable tenant and its address at that time), so a
// form can never reach a salon that has since taken over the address. The booking route refuses a token that is
// missing, forged, younger than MIN_FORM_MS (a script, not a person) or older
// than MAX_FORM_MS. It is friction against bots, not a secret.

export const MIN_FORM_MS = 3_000;
export const MAX_FORM_MS = 2 * 3600_000;

function sign(tenantId: string, slug: string, issued: number) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
  return createHmac("sha256", secret).update(`public-issued-at:v1:${tenantId}:${slug}:${issued}`).digest("hex");
}

/** A token for the page of this salon, served at `now`. */
export const issuedAtToken = (tenantId: string, slug: string, now = Date.now()) => `${now}.${sign(tenantId, slug, now)}`;

/** True when the token was issued for this salon and address between MIN_FORM_MS and MAX_FORM_MS before `now`. */
export function issuedAtValid(token: string, tenantId: string, slug: string, now = Date.now()): boolean {
  const match = /^(\d{13})\.([a-f0-9]{64})$/.exec(token);
  if (!match) return false;
  const issued = Number(match[1]);
  const expected = Buffer.from(sign(tenantId, slug, issued));
  const given = Buffer.from(match[2]);
  return given.length === expected.length && timingSafeEqual(given, expected) && now - issued >= MIN_FORM_MS && now - issued <= MAX_FORM_MS;
}
