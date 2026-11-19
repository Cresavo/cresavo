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
export type PlatformSite = "apex" | "demo" | "swedish-alias";

export type HostResolution =
  | { kind: "app" }
  | { kind: "site"; site: PlatformSite }
  | { kind: "business"; slug: string; via: "subdomain" | "domain" }
  | { kind: "unknown"; reason: UnknownReason };

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** True for a missing host or a loopback address, i.e. when the public host is unknown. */
export function isLocalHost(rawHost: string | null | undefined): boolean {
  const host = normalizeHost(rawHost);
  return !host || LOCAL_HOSTS.has(host);
}

/** `Host` header to a bare lower-case name: no port, no trailing dot. */
export function normalizeHost(host: string | null | undefined): string {
  return (host ?? "").trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
}

function isSwedishAlias(host: string) {
  if (typeof window !== "undefined") return false;
  const production = process.env.NODE_ENV === "production" && (!process.env.VERCEL_ENV || process.env.VERCEL_ENV === "production");
  const aliases = process.env.CONCEPT_SITE_SV_DOMAINS ?? (production ? "cresavo.se,www.cresavo.se" : "");
  return aliases.split(",").some(alias => normalizeHost(alias) === host);
}

export function resolveHost(rawHost: string | null | undefined, directory: Directory = DEMO_DIRECTORY, product = productDomain()): HostResolution {
  const host = normalizeHost(rawHost);
  if (!host || LOCAL_HOSTS.has(host) || host.endsWith(".vercel.app")) return { kind: "app" };
  if (host === product || host === `www.${product}`) return { kind: "site", site: "apex" };
  if (host === `demo.${product}`) return { kind: "site", site: "demo" };
  if (isSwedishAlias(host)) return { kind: "site", site: "swedish-alias" };
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

/** The product front door can also arrive at its rewritten path on an internal host. */
export function isProductHome(rawHost: string | null | undefined, pathname: string): boolean {
  const host = normalizeHost(rawHost);
  const resolution = resolveHost(host);
  if (resolution.kind === "site" && resolution.site === "apex") {
    return pathname === "/" || pathname === "/sv" || pathname === COMING_SOON_PATH;
  }
  return (pathname === COMING_SOON_PATH || pathname === "/sv") &&
    Boolean(process.env.NEXT_PUBLIC_CONCEPT_PRODUCT_DOMAIN) && (!host || LOCAL_HOSTS.has(host));
}

/** Where the two sites link to each other: absolute on the real hosts, paths of the same deployment everywhere else. */
export function siteLinks(rawHost: string | null | undefined, product = productDomain()): { apex: string; demo: string } {
  const resolution = resolveHost(rawHost, { domains: {} }, product);
  return resolution.kind === "site" ? { apex: `https://${product}/`, demo: `https://demo.${product}/studio` } : { apex: COMING_SOON_PATH, demo: "/studio" };
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

export type HostRoute =
  | { action: "next" }
  | { action: "rewrite"; path: string }
  | { action: "redirect"; path: string; targetHost?: string };

/** Resolve public entry points before the app handles its own routes. */
export function routeHost(rawHost: string | null | undefined, pathname: string, directory: Directory = DEMO_DIRECTORY, product = productDomain(), legacyHome = false): HostRoute {
  const resolution = resolveHost(rawHost, directory, product);
  if (resolution.kind === "app" || resolution.kind === "site") {
    if (resolution.kind === "site" && resolution.site === "swedish-alias") {
      const privacy = /^\/(?:sv\/)?privacy\/?$/.test(pathname);
      return { action: "redirect", targetHost: product, path: privacy ? "/sv/privacy" : "/sv" };
    }
    const root = pathname === "/" || pathname === "";
    if (resolution.kind === "site" && resolution.site === "demo" && (root || pathname === COMING_SOON_PATH)) {
      return { action: "redirect", path: "/studio" };
    }
    if (root && !(resolution.kind === "app" && legacyHome)) return { action: "rewrite", path: COMING_SOON_PATH };
    return { action: "next" };
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
