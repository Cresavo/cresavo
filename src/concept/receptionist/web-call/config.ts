// The public web call ("Ring Maja" on the demo): its switch and its limits.
// No imports beyond the receptionist's own switch, so pages, routes and the
// proxy can all read it.

import { receptionistEnabled } from "../flag";
import { limitsFrom, type CallLimits } from "../limits";

type Env = Record<string, string | undefined>;

/**
 * The kill switch. The web call is on only when the receptionist is on
 * (`PHONE_RECEPTIONIST_ENABLED=1`) and `PHONE_RECEPTIONIST_WEB_CALL=1`.
 * Anything else, including unset, means off: the page says the line is
 * closed, the call route answers 404 and calls already running are hung up
 * the next time any web-call request reaches the server.
 */
export function webCallEnabled(env: Env = process.env): boolean {
  return receptionistEnabled(env) && env.PHONE_RECEPTIONIST_WEB_CALL === "1";
}

/** The newest Realtime model when this was written (OpenAI docs, 26 Nov 2026). */
export const WEB_CALL_DEFAULT_MODEL = "gpt-realtime-2.1";
const MODEL_NAME = /^gpt-realtime[a-z0-9.-]{0,40}$/;

/** `PHONE_RECEPTIONIST_WEB_MODEL` replaces the default, e.g. `gpt-realtime-2.1-mini` for the cheaper tier. */
export function webCallModel(env: Env = process.env): string {
  const chosen = env.PHONE_RECEPTIONIST_WEB_MODEL?.trim();
  return chosen && MODEL_NAME.test(chosen) ? chosen : WEB_CALL_DEFAULT_MODEL;
}

/** Hard length of one web call, enforced by the server. */
export const WEB_CALL_MAX_SECONDS = 240;

export function webCallLimits(env: Env = process.env): CallLimits {
  const base = limitsFrom(env);
  return { maxSeconds: Math.min(WEB_CALL_MAX_SECONDS, base.maxSeconds), maxCostUsd: base.maxCostUsd };
}

export interface WebCallQuota {
  perIpPerHour: number;
  perSessionPerHour: number;
  perDay: number;
}

function bounded(value: string | undefined, fallback: number, min: number, max: number): number {
  const number = Number(value);
  return value && Number.isInteger(number) && number >= min && number <= max ? number : fallback;
}

/** 3 calls an hour per address and per page session; `PHONE_RECEPTIONIST_WEB_DAILY` (1 to 200, default 30) calls a day in all. */
export function webCallQuota(env: Env = process.env): WebCallQuota {
  return { perIpPerHour: 3, perSessionPerHour: 3, perDay: bounded(env.PHONE_RECEPTIONIST_WEB_DAILY, 30, 1, 200) };
}
