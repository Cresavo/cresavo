import { DEMO_DIRECTORY } from "./directory";
import { productDomain } from "./address";
import { checkSlug } from "./slug";

// One place that turns a request's host into a business. The proxy asks it
// for every request; the tests pin the rules.

export interface Directory {
  /** Own domains (level 3) and the slug each one belongs to. */
  domains: Readonly<Record<string, string>>;
}

export type UnknownReason = "reserved" | "invalid" | "not-connected";

export type HostResolution =
  | { kind: "app" }
  | { kind: "business"; slug: string; via: "subdomain" | "domain" }
  | { kind: "unknown"; reason: UnknownReason };

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** `Host` header to a bare lower-case name: no port, no trailing dot. */
export function normalizeHost(host: string | null | undefined): string {
  return (host ?? "").trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
}

export function resolveHost(rawHost: string | null | undefined, directory: Directory = DEMO_DIRECTORY, product = productDomain()): HostResolution {
  const host = normalizeHost(rawHost);
  if (!host || host === product || host === `www.${product}` || LOCAL_HOSTS.has(host) || host.endsWith(".vercel.app")) return { kind: "app" };
  const own = directory.domains[host];
  if (own) return { kind: "business", slug: own, via: "domain" };
  if (host.endsWith(`.${product}`)) {
    const label = host.slice(0, -product.length - 1);
    const check = checkSlug(label);
    if (check.ok) return { kind: "business", slug: check.slug, via: "subdomain" };
    return { kind: "unknown", reason: check.problem === "reserved" ? "reserved" : "invalid" };
  }
  return { kind: "unknown", reason: "not-connected" };
}

export const UNKNOWN_PATH = "/unknown-address";

/** Public booking pages live at the root of a business's own address; everything else stays on the product host. */
const PUBLIC_PREFIXES = ["/_next/", "/demo/", "/favicon", "/boka/"];
const BOOKING_PATHS = /^\/(?:me|gift|widget|booking\/[^/]+)\/?$/;

export type HostRoute = { action: "next" } | { action: "rewrite"; path: string };

/** What the proxy does with this request: serve it as is, or serve another path under the same address. */
export function routeHost(rawHost: string | null | undefined, pathname: string, directory: Directory = DEMO_DIRECTORY, product = productDomain()): HostRoute {
  const resolution = resolveHost(rawHost, directory, product);
  if (resolution.kind === "app") return { action: "next" };
  if (resolution.kind === "unknown") return pathname.startsWith("/_next/") ? { action: "next" } : { action: "rewrite", path: UNKNOWN_PATH };
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return { action: "next" };
  if (pathname === "/" || pathname === "") return { action: "rewrite", path: `/boka/${resolution.slug}` };
  if (BOOKING_PATHS.test(pathname)) return { action: "rewrite", path: `/boka/${resolution.slug}${pathname.replace(/\/$/, "")}` };
  return { action: "rewrite", path: UNKNOWN_PATH };
}
