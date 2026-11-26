import { createHash, createHmac } from "node:crypto";
import { z } from "zod";
import { realtimeSession } from "../realtime-config";
import { webCallLimits, webCallModel, webCallQuota } from "./config";
import type { CallLedger } from "./ledger";
import { webCallInstructions, type WebCallSalon } from "./persona";
import { estimateResponseCost, ratesFor, type CallLimits, type RealtimeUsage } from "../limits";

// The server half of the public web call. The browser sends its WebRTC offer
// here; this server adds the session (model, rules, tools) and exchanges the
// offer for an answer with OpenAI using the API key, which never leaves the
// server. OpenAI answers with the call's id, so the server can end the call
// itself: at the hard time limit, when the kill switch is off, or when the
// browser says it hung up. The browser never holds a credential at all, not
// even a short-lived one.

const REALTIME_CALLS = "https://api.openai.com/v1/realtime/calls";
const TIMEOUT_MS = 10_000;
/** The SDP of a browser offer is a few kilobytes; anything far larger is not one. */
export const MAX_OFFER_BYTES = 24_000;

export const webCallInput = z.object({
  token: z.string().min(10).max(200),
  sdp: z.string().min(20).max(MAX_OFFER_BYTES).refine((sdp) => sdp.startsWith("v=0"), "not an SDP offer"),
  salon: z.object({
    salonName: z.string().trim().min(1).max(80),
    language: z.enum(["sv", "en"]),
    ownerName: z.string().trim().max(40),
  }).strict(),
}).strict();

export type WebCallInput = z.infer<typeof webCallInput>;

/** The Realtime session of a web call: the receptionist's session, with the web-call voice, model and turn-taking. */
export function webCallSession(salon: WebCallSalon, model: string) {
  const base = realtimeSession({ salonName: salon.salonName, language: salon.language, greeting: "", model });
  return {
    ...base,
    instructions: webCallInstructions(salon),
    // Quick to answer; the salon's tools do the thinking that matters.
    reasoning: { effort: "low" },
    audio: {
      input: {
        ...base.audio.input,
        // Server VAD with a slightly raised threshold and a calm pause: a short "mm" or "okej" while Maja
        // speaks is less likely to cut her off, and she waits for the caller to finish before answering.
        turn_detection: { type: "server_vad", threshold: 0.6, prefix_padding_ms: 300, silence_duration_ms: 600, create_response: true, interrupt_response: true },
      },
      output: { ...base.audio.output, voice: "marin" },
    },
  };
}

/** A stable, non-identifying label for the provider's abuse monitoring. */
const safetyIdentifier = (client: string) => createHash("sha256").update(`receptionist-web:${client}`).digest("hex").slice(0, 32);

/** Keys in the ledger never hold an address or a session id in the clear. */
export const ledgerKey = (secret: string, kind: string, value: string) => `${kind}:${createHmac("sha256", secret).update(`web-call:${kind}:${value}`).digest("base64url").slice(0, 32)}`;

/** The call id from the `Location` header of `POST /v1/realtime/calls` (".../realtime/calls/rtc_123"). */
export function callIdFrom(location: string | null): string | null {
  const id = location?.trim().split("?")[0].split("/").filter(Boolean).pop();
  return id && /^[A-Za-z0-9_-]{6,120}$/.test(id) ? id : null;
}

export type Refusal = "rate_limited" | "session_limited" | "daily_limit" | "provider_unavailable";

export type StartResult =
  | { ok: true; callId: string; sdp: string; limits: CallLimits; model: string; deadline: number; instructions: string }
  | { ok: false; error: Refusal; retryAfter?: number };

export interface StartOptions {
  apiKey: string;
  secret: string;
  ledger: CallLedger;
  /** The verified client address. */
  client: string;
  /** The page session from the page token. */
  session: string;
  env?: Record<string, string | undefined>;
  fetch?: typeof fetch;
  now?: () => number;
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Counts the call against every limit, then creates it with OpenAI. A refused call costs nothing. */
export async function startWebCall(input: WebCallInput, options: StartOptions): Promise<StartResult> {
  const env = options.env ?? process.env;
  const now = options.now ?? Date.now;
  const quota = webCallQuota(env);
  const { ledger, secret } = options;
  const ip = await ledger.take(ledgerKey(secret, "ip", options.client), quota.perIpPerHour, HOUR, now());
  if (!ip.ok) return { ok: false, error: "rate_limited", retryAfter: ip.retryAfter };
  const page = await ledger.take(ledgerKey(secret, "sid", options.session), quota.perSessionPerHour, HOUR, now());
  if (!page.ok) return { ok: false, error: "session_limited", retryAfter: page.retryAfter };
  const day = await ledger.take("day", quota.perDay, DAY, now());
  if (!day.ok) return { ok: false, error: "daily_limit", retryAfter: day.retryAfter };

  const model = webCallModel(env);
  const limits = webCallLimits(env);
  const session = webCallSession(input.salon, model);
  const form = new FormData();
  form.set("sdp", input.sdp);
  form.set("session", JSON.stringify(session));
  let response: Response;
  try {
    response = await (options.fetch ?? fetch)(REALTIME_CALLS, {
      method: "POST",
      headers: { Authorization: `Bearer ${options.apiKey}`, "OpenAI-Safety-Identifier": safetyIdentifier(options.client) },
      body: form,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return { ok: false, error: "provider_unavailable" };
  }
  // The provider's message could quote the request; nothing of it is passed on or logged.
  if (!response.ok) return { ok: false, error: "provider_unavailable" };
  const callId = callIdFrom(response.headers.get("location"));
  const sdp = await response.text().catch(() => "");
  if (!callId) {
    // Without the id the server could not end this call, so it is not handed to the browser.
    return { ok: false, error: "provider_unavailable" };
  }
  if (!sdp.startsWith("v=0")) {
    await hangUp(callId, options.apiKey, options.fetch);
    return { ok: false, error: "provider_unavailable" };
  }
  const deadline = now() + limits.maxSeconds * 1000;
  try {
    await ledger.register(callId, deadline);
  } catch (error) {
    // A call the ledger does not know could never be swept or switched off: end it now.
    await hangUp(callId, options.apiKey, options.fetch);
    throw error;
  }
  return { ok: true, callId, sdp, limits, model, deadline, instructions: session.instructions };
}

/** Ends a call at OpenAI. True when OpenAI took it, or the call was already over. */
export async function hangUp(callId: string, apiKey: string, call: typeof fetch = fetch): Promise<boolean> {
  try {
    const response = await call(`${REALTIME_CALLS}/${encodeURIComponent(callId)}/hangup`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    // 404: the call already ended (the caller hung up, or the connection never came up).
    return response.ok || response.status === 404;
  } catch {
    return false;
  }
}

/**
 * Hangs up a running call and marks it over once OpenAI confirmed. A failed
 * hang-up leaves the call marked running, so the deadline task and every later
 * sweep try again. Returns true when the call is over.
 */
export async function endWebCall(callId: string, options: { apiKey: string; ledger: CallLedger; fetch?: typeof fetch }): Promise<boolean> {
  if (!(await options.ledger.isRunning(callId))) return true;
  if (!(await hangUp(callId, options.apiKey, options.fetch))) return false;
  await options.ledger.finish(callId);
  return true;
}

/**
 * Hangs up every call past its deadline. Runs on every web-call request, so a
 * call whose own timer was lost (the server instance was recycled) is still
 * ended by the next request that reaches any instance.
 */
export async function sweepOverdue(options: { apiKey: string; ledger: CallLedger; fetch?: typeof fetch; now?: () => number }): Promise<number> {
  const ids = await options.ledger.overdue((options.now ?? Date.now)(), 20);
  for (const id of ids) await endWebCall(id, options);
  return ids.length;
}

/** With the kill switch off, every call still running is hung up. */
export async function hangUpAll(options: { apiKey: string; ledger: CallLedger; fetch?: typeof fetch }): Promise<number> {
  const ids = await options.ledger.running(50);
  for (const id of ids) await endWebCall(id, options);
  return ids.length;
}

/** Waits until the call's deadline, then ends it. Scheduled with `after()` by the route that started the call. */
export async function enforceDeadline(callId: string, deadline: number, options: { apiKey: string; ledger: CallLedger; fetch?: typeof fetch; now?: () => number; sleep?: (ms: number) => Promise<void> }): Promise<void> {
  const sleep = options.sleep ?? ((ms) => new Promise<void>((resolve) => { setTimeout(resolve, ms).unref?.(); }));
  await sleep(Math.max(0, deadline - (options.now ?? Date.now)()));
  await endWithRetries(callId, options, sleep);
}

/** The parts of a WebSocket the supervisor uses; the global WebSocket satisfies it. */
export interface SidebandSocket {
  addEventListener(type: "message", listener: (event: { data: unknown }) => void): void;
  addEventListener(type: "open" | "close" | "error", listener: () => void): void;
  close(): void;
}

/** Opens the server's own connection to a running call ("sideband"), authenticated with the API key. */
export function openSideband(callId: string, apiKey: string): SidebandSocket {
  const url = `wss://api.openai.com/v1/realtime?call_id=${encodeURIComponent(callId)}`;
  // Node's WebSocket (undici) takes request headers in its init object.
  const Socket = WebSocket as unknown as new (url: string, init: { headers: Record<string, string> }) => SidebandSocket;
  return new Socket(url, { headers: { Authorization: `Bearer ${apiKey}` } });
}

export type SupervisorEnd = "deadline" | "cost" | "tampered" | "closed";

export interface SuperviseOptions {
  apiKey: string;
  ledger: CallLedger;
  limits: CallLimits;
  model: string;
  /** The instructions this server gave the call; a session that reports others was changed by the client. */
  instructions: string;
  fetch?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  connect?: (callId: string, apiKey: string) => SidebandSocket;
}

/**
 * Watches a running call from the server until it is over, and ends it when
 * it reaches its deadline, when the estimated cost reaches the ceiling (from
 * the usage OpenAI reports to the server, not the browser), or when the
 * session's instructions are changed by the client. If the server's own
 * connection cannot be opened, the deadline still holds. Scheduled with
 * `after()` by the route that started the call.
 */
export async function superviseCall(callId: string, deadline: number, options: SuperviseOptions): Promise<SupervisorEnd> {
  const sleep = options.sleep ?? ((ms) => new Promise<void>((resolve) => { setTimeout(resolve, ms).unref?.(); }));
  const now = options.now ?? Date.now;
  const rates = ratesFor(options.model);
  let cost = 0;
  let resolveEnd: (why: SupervisorEnd) => void = () => undefined;
  const ended = new Promise<SupervisorEnd>((resolve) => { resolveEnd = resolve; });
  let socket: SidebandSocket | undefined;
  try {
    socket = (options.connect ?? openSideband)(callId, options.apiKey);
    socket.addEventListener("message", (message) => {
      let event: { type?: string; response?: { usage?: RealtimeUsage }; session?: { instructions?: unknown } };
      try {
        event = JSON.parse(String(message.data));
      } catch {
        return;
      }
      if (event.type === "response.done") {
        cost += estimateResponseCost(event.response?.usage, rates);
        if (cost >= options.limits.maxCostUsd) resolveEnd("cost");
      }
      if (event.type === "session.updated" && typeof event.session?.instructions === "string" && event.session.instructions !== options.instructions) resolveEnd("tampered");
    });
    socket.addEventListener("close", () => resolveEnd("closed"));
    socket.addEventListener("error", () => undefined);
  } catch {
    socket = undefined;
  }
  const why = await Promise.race([ended, sleep(Math.max(0, deadline - now())).then(() => "deadline" as const)]);
  // Whatever ended the watch, the call is hung up: a call that already ended answers 404, which counts as done.
  // The sideband closing early fails closed: the call ends rather than running unwatched.
  await endWithRetries(callId, options, sleep);
  try {
    socket?.close();
  } catch {
    // Already closed.
  }
  return why;
}

async function endWithRetries(callId: string, options: { apiKey: string; ledger: CallLedger; fetch?: typeof fetch }, sleep: (ms: number) => Promise<void>) {
  // A failed hang-up is tried again a few times here; after that the sweeps keep trying.
  for (const pause of [0, 2_000, 5_000, 10_000]) {
    if (pause) await sleep(pause);
    if (await endWebCall(callId, options).catch(() => false)) return;
  }
}
