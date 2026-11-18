import { vi } from "vitest";

// A scripted fetch for connection adapter contract tests. Every call is kept
// so tests can assert request shape and headers; responses are queued in order.

export interface RecordedCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
}

type Reply = { status: number; body?: unknown; headers?: Record<string, string> } | Error;

export function scriptedFetch(...replies: Reply[]) {
  const calls: RecordedCall[] = [];
  const queue = [...replies];
  const fetch = vi.fn(async (input: string | URL | Request, init: RequestInit = {}) => {
    const headers: Record<string, string> = {};
    new Headers(init.headers).forEach((value, key) => { headers[key] = value; });
    calls.push({ url: String(input), method: init.method ?? "GET", headers, body: typeof init.body === "string" ? init.body : "" });
    const reply = queue.shift() ?? { status: 500, body: { error: "no scripted reply" } };
    if (reply instanceof Error) throw reply;
    const text = reply.body === undefined ? "" : typeof reply.body === "string" ? reply.body : JSON.stringify(reply.body);
    return new Response(text, { status: reply.status, headers: { "content-type": "application/json", ...reply.headers } });
  });
  return { fetch: fetch as unknown as typeof globalThis.fetch, calls };
}

export const timeoutError = () => Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });
export const networkError = () => new TypeError("fetch failed");

/** Strings that look like credentials. Adapter results and logs must never contain one. */
export const KEY_SHAPED = [
  /\b(sk|rk|pk)_(test|live)_[A-Za-z0-9]{8,}/,
  /\bwhsec_[A-Za-z0-9+/=]{8,}/,
  /\bre_[A-Za-z0-9_]{16,}/,
  /\bEAA[A-Za-z0-9]{20,}/,
  /\bya29\.[A-Za-z0-9._-]{10,}/,
  /\b1\/\/[A-Za-z0-9_-]{20,}/,
  /Bearer\s+[A-Za-z0-9._~+/-]{8,}/i,
  /Basic\s+[A-Za-z0-9+/=]{8,}/i,
  /SECRET[A-Za-z0-9_-]*/,
];
