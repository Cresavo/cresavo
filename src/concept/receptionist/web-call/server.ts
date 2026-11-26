import { createHash, createHmac } from "node:crypto";
import { z } from "zod";
import { realtimeSession } from "../realtime-config";
import { webCallLimits, webCallModel, webCallQuota } from "./config";
import type { CallLedger } from "./ledger";
import { webCallInstructions, type WebCallSalon } from "./persona";
import { estimateResponseCost, ratesFor, type CallLimits, type RealtimeUsage } from "../limits";
import { salonWith, teamWith } from "../../packs/base";
import { callRecorder, type CallReport } from "./report";
import { demoSalonFacts } from "./facts";

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

/** The public demo's salon, from the demo data on the server: its name and its owner. */
export function demoWebCallSalon(language: "sv" | "en"): WebCallSalon {
  const person = { title: "", bio: "" };
  const owner = teamWith(person, person).find((member) => /owner|ägare/i.test(member.role));
  return { salonName: salonWith("").name, language, ownerName: owner?.firstName ?? "" };
}

/** The Realtime session of a web call: the receptionist's session, with the web-call voice, model and turn-taking. */
export function webCallSession(salon: WebCallSalon, model: string, facts = "") {
  const base = realtimeSession({ salonName: salon.salonName, language: salon.language, greeting: "", model });
  return {
    ...base,
    instructions: webCallInstructions(salon, facts),
    // Quick to answer; the salon's tools do the thinking that matters.
    reasoning: { effort: "low" },
    audio: {
      input: {
        ...base.audio.input,
        // Callers ring from cars, on speaker, on patchy mobile lines. Semantic turn detection with low eagerness
        // waits for the end of what they mean, so a pause mid-sentence or a short dropout does not split the
        // turn and get the first half answered on its own (server VAD with 600 ms of silence did exactly that).
        // Far-field noise reduction suits a phone on speaker or in a holder rather than at the ear.
        noise_reduction: { type: "far_field" },
        turn_detection: { type: "semantic_vad", eagerness: "low", create_response: true, interrupt_response: true },
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
  | { ok: true; callId: string; sdp: string; limits: CallLimits; model: string; deadline: number; instructions: string; toolNames: string[] }
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
  const ip = await ledger.takeRolling(ledgerKey(secret, "ip", options.client), quota.perIpPerHour, HOUR, now());
  if (!ip.ok) return { ok: false, error: "rate_limited", retryAfter: ip.retryAfter };
  const page = await ledger.takeRolling(ledgerKey(secret, "sid", options.session), quota.perSessionPerHour, HOUR, now());
  if (!page.ok) {
    // A refused call takes nothing from the address: retries from one page do not lock out its neighbours.
    await ip.giveBack();
    return { ok: false, error: "session_limited", retryAfter: page.retryAfter };
  }
  const day = await ledger.take("day", quota.perDay, DAY, now());
  if (!day.ok) {
    await Promise.all([ip.giveBack(), page.giveBack()]);
    return { ok: false, error: "daily_limit", retryAfter: day.retryAfter };
  }

  // Nothing was started at OpenAI: the call costs no one a slot (a provider outage must not use up the day).
  const giveBack = async () => { await Promise.all([ip.giveBack(), page.giveBack(), day.giveBack()]).catch(() => undefined); };
  const model = webCallModel(env);
  const limits = webCallLimits(env);
  // The page's salon names are display only: the rules are built from the demo salon's own data on the server,
  // so a crafted name cannot write into Maja's instructions or make her another business.
  const session = webCallSession(demoWebCallSalon(input.salon.language), model, demoSalonFacts(new Date(now())));
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
    await giveBack();
    return { ok: false, error: "provider_unavailable" };
  }
  // The provider's message could quote the request; nothing of it is passed on or logged.
  if (!response.ok) {
    await giveBack();
    return { ok: false, error: "provider_unavailable" };
  }
  const callId = callIdFrom(response.headers.get("location"));
  const sdp = await response.text().catch(() => "");
  if (!callId) {
    // Without the id the server could not end this call, so it is not handed to the browser. A call may exist
    // at OpenAI that only its own limits end, so its slots stay taken.
    return { ok: false, error: "provider_unavailable" };
  }
  if (!sdp.startsWith("v=0")) {
    if (await hangUp(callId, options.apiKey, options.fetch)) await giveBack();
    return { ok: false, error: "provider_unavailable" };
  }
  const deadline = now() + limits.maxSeconds * 1000;
  try {
    await ledger.register(callId, deadline, ledgerKey(secret, "sid", options.session));
  } catch (error) {
    // A call the ledger does not know could never be swept or switched off: end it now.
    await hangUp(callId, options.apiKey, options.fetch);
    throw error;
  }
  return { ok: true, callId, sdp, limits, model, deadline, instructions: session.instructions, toolNames: session.tools.map((tool) => tool.name) };
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
  return (await endCall(callId, options)) !== "failed";
}

/** Ends a call and says how: it had already ended, this hung it up, or the hang-up failed. */
async function endCall(callId: string, options: { apiKey: string; ledger: CallLedger; fetch?: typeof fetch }): Promise<"already" | "hung_up" | "failed"> {
  if (!(await options.ledger.isRunning(callId))) return "already";
  if (!(await hangUp(callId, options.apiKey, options.fetch))) return "failed";
  await options.ledger.finish(callId);
  return "hung_up";
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

export type SupervisorEnd = "deadline" | "cost" | "tampered" | "closed" | "unwatched" | "switched_off" | "hung_up";

/** How often a running call looks at the kill switch. */
const SWITCH_CHECK_MS = 10_000;

type ReportedSession = {
  instructions?: unknown; tools?: ({ name?: unknown } & Record<string, unknown>)[]; tool_choice?: unknown; output_modalities?: unknown; max_output_tokens?: unknown;
  model?: unknown; audio?: { input?: { turn_detection?: unknown }; output?: { voice?: unknown } };
};

/** The parts of a session a caller must not change: rules, whole tool definitions, voice, turn-taking, output size. */
/** JSON with object keys in a fixed order, so the same definitions always read the same. */
const stable = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
};

const sessionControls = (session: ReportedSession) => stable([
  session.instructions, [...(session.tools ?? [])].sort((a, b) => String(a?.name).localeCompare(String(b?.name))), session.tool_choice, session.output_modalities,
  session.max_output_tokens, session.model, session.audio?.input?.turn_detection, session.audio?.output?.voice,
]);

export interface SuperviseOptions {
  apiKey: string;
  ledger: CallLedger;
  limits: CallLimits;
  model: string;
  /** The instructions this server gave the call; a session that reports others was changed by the client. */
  instructions: string;
  /** The tools this server gave the call, by name; a session that reports others was changed by the client. */
  toolNames?: readonly string[];
  /** The kill switch, read again while the call runs; when it turns off, the call ends. */
  enabled?: () => boolean;
  /** Called once when the call is over, with the shape of what the server saw (no words; see report.ts). */
  onReport?: (report: CallReport, why: SupervisorEnd) => void;
  fetch?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  connect?: (callId: string, apiKey: string) => SidebandSocket;
}

/**
 * Watches a running call from the server until it is over, and ends it when
 * it reaches its deadline, when the estimated cost reaches the ceiling (from
 * the usage OpenAI reports to the server, not the browser), or when the
 * session's rules, tools, voice or turn-taking are changed by the client. If
 * the server's own connection fails or closes, the call is ended rather than
 * left running unwatched. Scheduled with
 * `after()` by the route that started the call.
 */
export async function superviseCall(callId: string, deadline: number, options: SuperviseOptions): Promise<SupervisorEnd> {
  const sleep = options.sleep ?? ((ms) => new Promise<void>((resolve) => { setTimeout(resolve, ms).unref?.(); }));
  const now = options.now ?? Date.now;
  const rates = ratesFor(options.model);
  let cost = 0;
  const recorder = callRecorder(rates, now);
  let resolveEnd: (why: SupervisorEnd) => void = () => undefined;
  const ended = new Promise<SupervisorEnd>((resolve) => { resolveEnd = resolve; });
  let socket: SidebandSocket | undefined;
  try {
    socket = (options.connect ?? openSideband)(callId, options.apiKey);
    let baseline: string | undefined;
    socket.addEventListener("message", (message) => {
      let event: { type?: string; response?: { usage?: RealtimeUsage; output_modalities?: unknown }; session?: ReportedSession };
      try {
        event = JSON.parse(String(message.data));
      } catch {
        return;
      }
      try {
        recorder.observe(event as Parameters<typeof recorder.observe>[0]);
      } catch {
        // The report is a side note; it never stops the watch.
      }
      if (event.type === "response.done") {
        cost += estimateResponseCost(event.response?.usage, rates);
        if (cost >= options.limits.maxCostUsd) resolveEnd("cost");
      }
      // Maja only ever speaks. A text-only answer was asked for by someone using the line as a general model.
      // (A caller can still word a spoken answer's instructions per response, which OpenAI does not report;
      // the 4-minute call, the cost ceiling and the hourly and daily limits bound what that can cost.)
      const modalities = event.response?.output_modalities;
      if ((event.type === "response.created" || event.type === "response.done") && Array.isArray(modalities) && !modalities.includes("audio")) resolveEnd("tampered");
      if ((event.type === "session.created" || event.type === "session.updated") && event.session) {
        // The client never changes the session (it only asks for answers), so the first session reported is the
        // one this server created: it must carry our rules and tools, and nothing it controls may change after.
        const session = event.session;
        const names = (session.tools ?? []).map((tool) => tool?.name).sort();
        const ours = session.instructions === options.instructions && (!options.toolNames || JSON.stringify(names) === JSON.stringify([...options.toolNames].sort()));
        const controls = sessionControls(session);
        if (!ours || (baseline !== undefined && controls !== baseline)) resolveEnd("tampered");
        baseline ??= controls;
      }
    });
    socket.addEventListener("close", () => resolveEnd("closed"));
    // A connection that fails (refused key, handshake) leaves the call unwatched: it ends rather than run on.
    socket.addEventListener("error", () => resolveEnd("unwatched"));
  } catch {
    socket = undefined;
    resolveEnd("unwatched");
  }
  let settled = false;
  if (options.enabled) {
    const enabled = options.enabled;
    void (async () => {
      while (!settled) {
        await sleep(SWITCH_CHECK_MS);
        if (!settled && !enabled()) resolveEnd("switched_off");
      }
    })();
  }
  let why: SupervisorEnd = await Promise.race([ended, sleep(Math.max(0, deadline - now())).then(() => "deadline" as const)]);
  settled = true;
  // The connection also drops when the caller or Maja simply hung up (the end route already ended the call).
  // Whatever ended the watch, the call is hung up: a call that already ended answers 404, which counts as done.
  // The sideband closing early fails closed: the call ends rather than running unwatched.
  const outcome = await endWithRetries(callId, options, sleep);
  // The connection also drops when the caller or Maja simply hung up: the end route had already ended the call.
  if ((why === "closed" || why === "unwatched") && outcome === "already") why = "hung_up";
  try {
    socket?.close();
  } catch {
    // Already closed.
  }
  try {
    options.onReport?.(recorder.finish(), why);
  } catch {
    // Logging never changes how the call ended.
  }
  return why;
}

async function endWithRetries(callId: string, options: { apiKey: string; ledger: CallLedger; fetch?: typeof fetch }, sleep: (ms: number) => Promise<void>) {
  // A failed hang-up is tried again a few times here; after that the sweeps keep trying.
  for (const pause of [0, 2_000, 5_000, 10_000]) {
    if (pause) await sleep(pause);
    const outcome = await endCall(callId, options).catch(() => "failed" as const);
    if (outcome !== "failed") return outcome;
  }
  return "failed" as const;
}
