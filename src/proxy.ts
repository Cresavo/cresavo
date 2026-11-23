import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { parseLocale } from "./lib/locale";
import { setDemoVisitorCookie, setLocaleCookie } from "./lib/locale-cookie";
import { isPublicReadonly, publicReadonlyResponse } from "./lib/public-readonly";
import { sandboxConfig, sandboxCronHost, sandboxHost, sandboxRequested } from "./lib/agent-api/sandbox/config";
import { contentSecurityPolicy, createNonce, cspExempt, frameOptions } from "./lib/csp";
import { MAX_IMPORT_ACTION_BYTES } from "./lib/owner-actions/types";
import { MAX_MEDIA_BYTES } from "./lib/media/limits";
import { productSiteOrigin } from "./concept/site/origin";
import { siteRequestHost } from "./concept/site/request-host";
import { galleryAvailable } from "./concept/server/gallery";
import { conceptRoute } from "./concept/page/language";
import { isProductHome, routeHost, UNKNOWN_PATH, type HostRoute } from "./concept/page/resolve";

/** Consume the explicit demo link before rendering. The product site's demo buttons say which language the visitor
 *  chose there, so that choice replaces a language saved on an earlier visit. */
function demoLanguageEntry(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const studio = conceptRoute(pathname) === "studio";
  if ((!studio && pathname !== "/boka/salong-eko") || !searchParams.has("lang") || request.method !== "GET") return;
  if (request.headers.has("next-router-prefetch") || request.headers.get("purpose") === "prefetch") return;
  const language = parseLocale(searchParams.get("lang"));
  const url = request.nextUrl.clone();
  url.searchParams.delete("lang");
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "private, no-store");
  if (language) {
    if (studio) setLocaleCookie(response, language);
    setDemoVisitorCookie(response, language);
  }
  return response;
}

type Csp = { nonce: string; policy: string; frame: "DENY" | "SAMEORIGIN" | null };

function pageCsp(pathname: string): Csp | undefined {
  if (cspExempt(pathname)) return;
  const nonce = createNonce();
  return { nonce, policy: contentSecurityPolicy(nonce, pathname), frame: frameOptions(pathname) };
}

/** The framing and script policy of a page, on the response. */
function setCspHeaders(response: Response, csp: Csp) {
  response.headers.set("Content-Security-Policy", csp.policy);
  if (csp.frame) response.headers.set("X-Frame-Options", csp.frame);
}

/** Rendering reads the nonce from the request headers; never trust client-supplied values. */
function applyCsp(requestHeaders: Headers, csp: Csp | undefined) {
  requestHeaders.delete("content-security-policy");
  requestHeaders.delete("x-nonce");
  if (!csp) return;
  requestHeaders.set("content-security-policy", csp.policy);
  requestHeaders.set("x-nonce", csp.nonce);
}

/**
 * One deployment, several addresses: the product domain shows the coming-soon page, its demo
 * subdomain the studio, a business's own address (subdomain or own domain) its booking
 * page, and an address that leads nowhere the friendly page.
 */
function hostResponse(request: NextRequest, host: string | null | undefined, route: HostRoute, csp: Csp | undefined) {
  if (route.action === "redirect") {
    // Keep the demo's public authority behind a proxy.
    const url = new URL(route.path + request.nextUrl.search, `${request.nextUrl.protocol}//${host}`);
    return NextResponse.redirect(url);
  }
  if (route.action === "next") {
    const entry = demoLanguageEntry(request);
    if (entry) return entry;
  }
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete("x-concept-address");
  requestHeaders.delete("x-concept-english");
  requestHeaders.delete("x-concept-route");
  applyCsp(requestHeaders, csp);
  const path = route.action === "rewrite" ? route.path : request.nextUrl.pathname;
  const concept = conceptRoute(path);
  if (concept === "english") requestHeaders.set("x-concept-english", "1");
  else if (concept) requestHeaders.set("x-concept-route", concept);
  const address = path === UNKNOWN_PATH
    ? (route.action === "rewrite" ? host : request.nextUrl.searchParams.get("host"))?.slice(0, 100)
    : undefined;
  if (address) requestHeaders.set("x-concept-address", address);
  const options = { request: { headers: requestHeaders } };
  if (route.action === "next") return NextResponse.next(options);
  const url = request.nextUrl.clone();
  url.pathname = route.path;
  if (path === UNKNOWN_PATH) url.search = address ? `?host=${encodeURIComponent(address)}` : "";
  return NextResponse.rewrite(url, options);
}

const OWNER_ACTIONS_PATH = "/api/owner/salon/actions";
/** What the owner actions route reads at most: its largest action cap plus the envelope (`app/api/owner/salon/actions/route.ts`). */
export const OWNER_ACTIONS_MAX_BODY_BYTES = MAX_IMPORT_ACTION_BYTES + 1024;
const OWNER_MEDIA_PATH = "/api/owner/media";
const OWNER_BODY_CAPS = new Map([[OWNER_ACTIONS_PATH, OWNER_ACTIONS_MAX_BODY_BYTES], [OWNER_MEDIA_PATH, MAX_MEDIA_BYTES]]);

/**
 * Next.js clones and buffers a proxied request's body (10 MiB by default) before it calls this proxy, so the
 * self-hosted HTTP entry point (`scripts/server.mjs`, `scripts/owner-body-limit.mjs`) refuses an oversized body
 * first. This is the second line, for any other way of running the app: it refuses what the route would never read.
 * The same holds for a picture uploaded to the photo library (`app/api/owner/media/route.ts`).
 */
function ownerActionsTooLarge(request: NextRequest) {
  const cap = request.method === "POST" ? OWNER_BODY_CAPS.get(request.nextUrl.pathname.replace(/\/+$/, "")) : undefined;
  if (cap === undefined || !(Number(request.headers.get("content-length") ?? 0) > cap)) return;
  return NextResponse.json({ error: "too_large" }, { status: 413, headers: { "Cache-Control": "no-store" } });
}

export function proxy(request: NextRequest) {
  if (sandboxRequested()) return sandboxProxy(request);
  const tooLarge = ownerActionsTooLarge(request);
  if (tooLarge) return tooLarge;
  const host = siteRequestHost((name) => request.headers.get(name));
  const { pathname } = request.nextUrl;
  if (/^\/studio\/(?:_|%5[fF])gallery\/?$/.test(pathname) && !galleryAvailable(host)) {
    return new NextResponse(null, { status: 404 });
  }
  const route = routeHost(host, pathname, undefined, undefined, process.env.LEGACY_HOME === "1");
  // An alias serves no pages or assets of its own.
  if (route.action === "redirect" && route.targetHost) {
    return NextResponse.redirect(new URL(route.path + request.nextUrl.search, `https://${route.targetHost}`), 308);
  }
  if (pathname.startsWith("/_next/static/") || pathname === "/_next/image" || pathname === "/favicon.ico") {
    return NextResponse.next();
  }
  // A business's own address serves its booking page and widget at the root, so the policy follows the page it is rewritten to.
  const csp = pageCsp(route.action === "rewrite" ? route.path : pathname);
  const response = publicReadonlyResponse(request) ?? hostResponse(request, host, route, csp);
  if (csp) setCspHeaders(response, csp);
  const discoveryFile = (pathname === "/robots.txt" || pathname === "/sitemap.xml") && productSiteOrigin(host);
  // The product homepages are the only pages of the read-only deployment intended for search.
  if (isPublicReadonly() && !isProductHome(host, pathname) && !discoveryFile) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return response;
}

function sandboxProxy(request: NextRequest) {
  try {
    const { origin } = sandboxConfig();
    const path = request.nextUrl.pathname;
    if (path === "/api/sandbox/reset" && sandboxCronHost(request, origin)) return NextResponse.next();
    if (path === "/" && request.method === "GET" && sandboxHost(request, origin) && request.nextUrl.origin === origin)
      return NextResponse.redirect(new URL("/sandbox?lang=sv", origin));
    if (sandboxHost(request, origin) &&
        (/^\/api\/v1\/(?:access|services|availability|(?:proposals|bookings)(?:\/[a-zA-Z0-9_-]{1,128})?)$/.test(path) ||
         /^\/(?:sandbox(?:\/phone)?|api\/sandbox\/(?:pair|phone(?:\/(?:redeem|decision))?))$/.test(path) ||
         path.startsWith("/_next/static/"))) {
      const csp = path.startsWith("/_next/static/") ? undefined : pageCsp(path);
      const requestHeaders = new Headers(request.headers);
      applyCsp(requestHeaders, csp);
      const response = NextResponse.next({ request: { headers: requestHeaders } });
      if (csp) setCspHeaders(response, csp);
      response.headers.set("X-Robots-Tag", "noindex, nofollow");
      return response;
    }
    return new NextResponse(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  } catch {
    return new NextResponse(null, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

// Every proxy run is a function invocation. Static files (build output, images,
// fonts, media) need no host routing or CSP, so they skip the proxy entirely.
export const config = {
  matcher: ["/((?!_next/static/|_next/image|favicon\\.ico$|.*\\.(?:png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|otf|css|js|map|mp4|webm|mp3)$).*)"],
};
