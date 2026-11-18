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

/** The platform's two public sites: the product domain itself (coming soon) and its demo. */
export type PlatformSite = "apex" | "demo";

export type HostResolution =
  | { kind: "app" }
  | { kind: "site"; site: PlatformSite }
  | { kind: "business"; slug: string; via: "subdomain" | "domain" }
  | { kind: "unknown"; reason: UnknownReason };

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** `Host` header to a bare lower-case name: no port, no trailing dot. */
export function normalizeHost(host: string | null | undefined): string {
  return (host ?? "").trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
}

export function resolveHost(rawHost: string | null | undefined, directory: Directory = DEMO_DIRECTORY, product = productDomain()): HostResolution {
  const host = normalizeHost(rawHost);
  if (!host || LOCAL_HOSTS.has(host) || host.endsWith(".vercel.app")) return { kind: "app" };
  if (host === product || host === `www.${product}`) return { kind: "site", site: "apex" };
  if (host === `demo.${product}`) return { kind: "site", site: "demo" };
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
export const COMING_SOON_PATH = "/coming-soon";
export const LANDING_PATH = "/landing";

// The product domain is the coming-soon page; its demo subdomain, preview deployments and a
// local server show the demo landing at `/`, so both sites can be seen without DNS (the
// coming-soon page is at COMING_SOON_PATH on every platform host).

/** Where the two sites link to each other: absolute on the real hosts, paths of the same deployment everywhere else. */
export function siteLinks(rawHost: string | null | undefined, product = productDomain()): { apex: string; demo: string } {
  const resolution = resolveHost(rawHost, { domains: {} }, product);
  return resolution.kind === "site" ? { apex: `https://${product}/`, demo: `https://demo.${product}/` } : { apex: COMING_SOON_PATH, demo: "/" };
}

/**
 * Where the demo-only "Open the owner's view" link on a booking page goes. On the platform's own hosts the
 * studio is a path of the same deployment; on a business's address (subdomain or own domain) there is no
 * studio, so the link goes to the demo site.
 */
export function ownerViewHref(rawHost: string | null | undefined, protocol = "https:", product = productDomain()): string {
  const resolution = resolveHost(rawHost, { domains: {} }, product);
  if (resolution.kind === "app" || resolution.kind === "site") return "/studio";
  // A subdomain of the product keeps the scheme and port it was opened with (a local server); an own domain is always https.
  const underProduct = normalizeHost(rawHost).endsWith(`.${product}`);
  const port = underProduct ? (rawHost ?? "").trim().match(/:(\d+)$/)?.[1] : undefined;
  return `${underProduct ? protocol : "https:"}//demo.${product}${port ? `:${port}` : ""}/studio`;
}

/** Public booking pages live at the root of a business's own address; everything else stays on the product host. */
const PUBLIC_PREFIXES = ["/_next/", "/demo/", "/tenant/", "/favicon"];
const BOOKING_PATHS = /^\/(?:me|gift|widget|booking\/[^/]+)\/?$/;

export type HostRoute = { action: "next" } | { action: "rewrite"; path: string };

/** What the proxy does with this request: serve it as is, or serve another path under the same address. */
export function routeHost(rawHost: string | null | undefined, pathname: string, directory: Directory = DEMO_DIRECTORY, product = productDomain(), legacyHome = false): HostRoute {
  const resolution = resolveHost(rawHost, directory, product);
  if (resolution.kind === "app" || resolution.kind === "site") {
    if (pathname !== "/" && pathname !== "") return { action: "next" };
    if (resolution.kind === "site" && resolution.site === "apex") return { action: "rewrite", path: COMING_SOON_PATH };
    // `legacyHome` keeps the older lab home at `/` for its own test suites (LEGACY_HOME=1); it never applies to the real sites.
    return resolution.kind === "app" && legacyHome ? { action: "next" } : { action: "rewrite", path: LANDING_PATH };
  }
  if (resolution.kind === "unknown") return pathname.startsWith("/_next/") ? { action: "next" } : { action: "rewrite", path: UNKNOWN_PATH };
  // A business's address serves its own booking paths only, never another business's `/boka/<slug>`.
  if (pathname.startsWith("/boka/")) {
    const own = `/boka/${resolution.slug}`;
    return pathname === own || pathname.startsWith(`${own}/`) ? { action: "next" } : { action: "rewrite", path: UNKNOWN_PATH };
  }
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return { action: "next" };
  if (pathname === "/" || pathname === "") return { action: "rewrite", path: `/boka/${resolution.slug}` };
  if (BOOKING_PATHS.test(pathname)) return { action: "rewrite", path: `/boka/${resolution.slug}${pathname.replace(/\/$/, "")}` };
  return { action: "rewrite", path: UNKNOWN_PATH };
}
