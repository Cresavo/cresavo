import { connectionError, type ConnectionError, type PortName } from "../core";

// The one HTTP helper live adapters use. It never logs, never puts a URL,
// header or provider message into an error, and maps statuses to the shared
// error codes. Adapters pass a `codeOf` to keep a short provider error code.

export type Fetcher = typeof fetch;

export interface HttpContext {
  port: PortName;
  provider: string;
  fetch: Fetcher;
  timeoutMs?: number;
  /** Values that must never surface, even as a provider error code. */
  secrets?: readonly string[];
}

export interface RequestOptions {
  /**
   * False for a write the provider cannot de-duplicate (an SMS without an
   * idempotency key). A timeout, dropped connection or 5xx may then have been
   * carried out, so the error is not marked retryable: a retry could send twice.
   */
  idempotent?: boolean;
}

const failure = (error: ConnectionError, idempotent: boolean): HttpOutcome =>
  ({ ok: false, error: idempotent || error.code === "rate_limited" ? error : { ...error, retryable: false } });

export type HttpOutcome = { ok: true; status: number; data: unknown; headers: Headers } | { ok: false; error: ConnectionError };

export function statusCode(status: number): ConnectionError["code"] {
  if (status === 400 || status === 422) return "invalid_input";
  if (status === 401) return "unauthorized";
  if (status === 402) return "rejected";
  if (status === 403) return "forbidden";
  if (status === 404 || status === 410) return "not_found";
  if (status === 409) return "conflict";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "provider_unavailable";
  return "unknown";
}

export function retryAfter(headers: Headers): number | undefined {
  const value = headers.get("retry-after");
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(Math.ceil(seconds), 3600);
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, Math.min(Math.ceil((date - Date.now()) / 1000), 3600));
}

function parse(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null; // Non-JSON bodies (HTML error pages) are dropped, never echoed.
  }
}

const transportCode = (error: unknown): ConnectionError["code"] => {
  const name = (error as { name?: string })?.name;
  return name === "TimeoutError" || name === "AbortError" ? "timeout" : "network";
};

export async function request(
  context: HttpContext,
  url: string,
  init: RequestInit,
  codeOf: (data: unknown, status: number) => { code?: ConnectionError["code"]; providerCode?: unknown } = () => ({}),
  { idempotent = true }: RequestOptions = {},
): Promise<HttpOutcome> {
  let response: Response;
  let body: string;
  try {
    response = await context.fetch(url, { ...init, redirect: "error", signal: AbortSignal.timeout(context.timeoutMs ?? 10_000) });
    // A body that fails half way is a transport failure, never an empty success.
    body = await response.text();
  } catch (error) {
    return failure(connectionError(context.port, context.provider, transportCode(error)), idempotent);
  }
  const data = parse(body);
  if (response.ok) return { ok: true, status: response.status, data, headers: response.headers };
  const mapped = codeOf(data, response.status);
  return failure(connectionError(context.port, context.provider, mapped.code ?? statusCode(response.status), {
    httpStatus: response.status,
    retryAfterSeconds: response.status === 429 || response.status === 503 ? retryAfter(response.headers) : undefined,
    providerCode: mapped.providerCode,
    secrets: context.secrets,
  }), idempotent);
}

export const form = (fields: Record<string, string | number | undefined>): string => {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) if (value !== undefined && value !== "") body.append(key, String(value));
  return body.toString();
};

export const basicAuth = (user: string, password: string): string => `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;

/** Object field access for untyped JSON. */
export function field(data: unknown, ...path: (string | number)[]): unknown {
  let value = data;
  for (const key of path) {
    if (value === null || typeof value !== "object") return undefined;
    value = (value as Record<string | number, unknown>)[key];
  }
  return value;
}

export const text = (value: unknown): string | undefined => (typeof value === "string" && value.trim() ? value : undefined);
