import { retryAfterSeconds, type ConsentResponse } from "./staging-copy";

/** How long the page waits for the salon's answer, body included, before treating it as unknown. */
export const CONSENT_REQUEST_TIMEOUT_MS = 20_000;

/**
 * One request to the decision endpoint with an application deadline that covers the response body
 * too: an intermediary that keeps a response open never leaves the page waiting. Past the deadline
 * the result is a network error (an unknown outcome, never a refusal). The salon's `Retry-After`
 * travels with the response that carried it.
 */
export async function consentRequest(endpoint: string, body: object,
  { fetch: send = globalThis.fetch, timeoutMs = CONSENT_REQUEST_TIMEOUT_MS }: { fetch?: typeof fetch; timeoutMs?: number } = {},
): Promise<{ response: ConsentResponse; retryAfter: number }> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(new Error("CONSENT_REQUEST_TIMEOUT")); }, timeoutMs);
  });
  try {
    const r = await Promise.race([send(endpoint, {
      method: "POST", cache: "no-store", redirect: "error", signal: controller.signal,
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }), deadline]);
    const json = r.headers.get("content-type")?.startsWith("application/json");
    // A body that fails to parse, or does not arrive in time, stays undefined.
    const parsed = json ? await Promise.race([r.json(), deadline]).catch(() => undefined) : undefined;
    return { response: { status: r.status, redirected: r.redirected, body: parsed },
      retryAfter: r.status === 429 ? retryAfterSeconds(r.headers.get("retry-after")) : 0 };
  } catch {
    return { response: "network-error", retryAfter: 0 };
  } finally {
    clearTimeout(timer);
  }
}
