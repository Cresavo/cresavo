"use client";

import type { MessageKey } from "../i18n";

// Requests and error messages for two-step sign-in. The API answers with codes only; the text comes from the dictionary.

const MFA_ERRORS = ["invalid_code", "mfa_expired", "not_configured", "wrong_password", "setup_expired", "already_enabled", "not_enabled"] as const;
type MfaErrorCode = (typeof MFA_ERRORS)[number];

/** The message for a failed two-step request. A malformed code reads as a wrong one. */
export function mfaError(status: number, code: unknown): MessageKey {
  if (status === 429) return "account.error.tooMany";
  if (code === "invalid") return "account.error.invalid_code";
  return MFA_ERRORS.includes(code as MfaErrorCode) ? `account.error.${code as MfaErrorCode}` : "account.error.generic";
}

export interface MfaAnswer {
  status: number;
  ok: boolean;
  body: Record<string, unknown>;
}

/** POSTs JSON to an owner route. A network failure reads as status 0. */
export async function postMfa(path: string, body: unknown): Promise<MfaAnswer> {
  try {
    const response = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return { status: response.status, ok: response.ok, body: await response.json().catch(() => ({})) };
  } catch {
    return { status: 0, ok: false, body: {} };
  }
}
