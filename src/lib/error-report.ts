// Optional error reporting to a Sentry-compatible endpoint (Sentry, GlitchTip,
// Bugsink ...) over its envelope HTTP API with plain fetch. No SDK. Inert
// unless ERROR_REPORT_DSN is set. The DSN decides where reports go: use a
// region in the EU (docs/operations/MONITORING.md).
//
// A report is built from scratch out of a short list of fields: the error's
// class name, file paths and line numbers of its stack, the route pattern, the
// release, the environment and the event code. Messages, causes, request
// bodies, headers, cookies, query strings, e-mails and IPs have no way in.

import { version } from "../../package.json";

export interface ReportContext {
  /** Fixed event code, e.g. BOOKING_INTERNAL_ERROR. */
  code: string;
  /** A route pattern, never a real URL. */
  route?: string;
}

const TIMEOUT_MS = 2000;
const CODE = /^[A-Z][A-Z0-9_]{2,63}$/;
const ROUTE = /^\/[A-Za-z0-9/_.[\]-]{0,119}$/;
const ERROR_NAME = /^[A-Za-z][A-Za-z0-9]{0,39}$/;
const MAX_FRAMES = 40;

// An error is reported once, however many layers see it.
const reported = new WeakSet<object>();
export function markReported(error: unknown) {
  if (error && typeof error === "object") reported.add(error);
}

export function parseDsn(dsn: string | undefined): { url: string; key: string } | null {
  if (!dsn) return null;
  try {
    const url = new URL(dsn);
    const loopback = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (!(url.protocol === "https:" || (url.protocol === "http:" && loopback)) || !url.username) return null;
    const parts = url.pathname.split("/").filter(Boolean);
    const project = parts.pop();
    if (!project || !/^[A-Za-z0-9_-]+$/.test(project)) return null;
    const prefix = parts.length ? `/${parts.join("/")}` : "";
    return { url: `${url.protocol}//${url.host}${prefix}/api/${project}/envelope/`, key: url.username };
  } catch {
    return null;
  }
}

export function sampleRate(raw: string | undefined): number {
  const rate = raw === undefined || raw.trim() === "" ? 1 : Number(raw);
  return Number.isFinite(rate) ? Math.min(1, Math.max(0, rate)) : 1;
}

/** File path, line and column of each stack line; the message and any query string are dropped. */
export function stackFrames(stack: unknown, cwd = process.cwd()) {
  if (typeof stack !== "string") return [];
  const frames: { filename: string; lineno: number; colno: number; function?: string }[] = [];
  for (const text of stack.split("\n")) {
    const match = /^\s+at (?:async )?(?:(.+?) \()?(.+?):(\d+):(\d+)\)?$/.exec(text);
    if (!match) continue;
    let filename = match[2].replace(/^file:\/\//, "").replace(/[?#].*$/, "");
    if (cwd.length > 1 && filename.startsWith(cwd)) filename = filename.slice(cwd.length + 1);
    const name = match[1];
    frames.push({ filename, lineno: Number(match[3]), colno: Number(match[4]), ...(name && /^[\w$.<>[\] ]{1,80}$/.test(name) ? { function: name } : {}) });
    if (frames.length >= MAX_FRAMES) break;
  }
  return frames.reverse(); // Sentry wants the oldest call first
}

export function buildEvent(error: unknown, context: ReportContext, now = Date.now()) {
  const name = error instanceof Error && ERROR_NAME.test(error.constructor.name) ? error.constructor.name : "Error";
  const code = CODE.test(context.code) ? context.code : "UNKNOWN";
  return {
    event_id: crypto.randomUUID().replaceAll("-", ""),
    timestamp: Math.floor(now / 1000),
    platform: "node",
    level: "error",
    release: version,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
    tags: { event_code: code, ...(context.route && ROUTE.test(context.route) ? { route: context.route } : {}) },
    // The value is the event code, not the error's message.
    exception: { values: [{ type: name, value: code, stacktrace: { frames: stackFrames(error instanceof Error ? error.stack : undefined) } }] },
  };
}

export function buildEnvelope(event: ReturnType<typeof buildEvent>, now = new Date()) {
  return [JSON.stringify({ event_id: event.event_id, sent_at: now.toISOString() }), JSON.stringify({ type: "event" }), JSON.stringify(event)].join("\n");
}

/** Fire and forget: returns at once, never throws, never waits for the network. */
export function reportError(error: unknown, context: ReportContext, random: () => number = Math.random): void {
  try {
    const target = parseDsn(process.env.ERROR_REPORT_DSN);
    if (!target) return;
    if (error && typeof error === "object") {
      if (reported.has(error)) return;
      reported.add(error);
    }
    if (random() >= sampleRate(process.env.ERROR_REPORT_SAMPLE_RATE)) return;
    fetch(target.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-sentry-envelope",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${target.key}, sentry_client=cresavo-error-report/${version}`,
      },
      body: buildEnvelope(buildEvent(error, context)),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    }).then((response) => response.body?.cancel(), () => undefined);
  } catch {
    // Monitoring must never break a request.
  }
}
