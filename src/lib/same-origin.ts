import { siteRequestHost } from "@/concept/site/request-host";

type ReadHeader = (name: string) => string | null | undefined;

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * True when an Origin header names this site's public host. The host comes
 * from the trusted proxy header when one is configured, as for host routing.
 * Production requires https except on loopback, where E2E runs over http.
 */
export function originMatchesSite(origin: string | null | undefined, readHeader: ReadHeader, fallbackHost?: string): boolean {
  if (!origin) return false;
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }
  const host = (siteRequestHost(readHeader) ?? fallbackHost)?.toLowerCase();
  if (!host || parsed.host !== host) return false;
  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") return LOOPBACK.has(parsed.hostname);
  return parsed.protocol === "https:" || parsed.protocol === "http:";
}

/**
 * CSRF guard for state-changing requests that carry ambient credentials.
 * Requires a matching Origin and rejects any Sec-Fetch-Site other than same-origin.
 */
export function isSameOriginWrite(readHeader: ReadHeader, fallbackHost?: string): boolean {
  const site = readHeader("sec-fetch-site");
  if (site && site !== "same-origin") return false;
  return originMatchesSite(readHeader("origin"), readHeader, fallbackHost);
}
