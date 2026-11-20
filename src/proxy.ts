import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { parseLocale } from "./lib/locale";
import { LOCALE_COOKIE, setDemoVisitorCookie, setLocaleCookie } from "./lib/locale-cookie";
import { isPublicReadonly, publicReadonlyResponse } from "./lib/public-readonly";
import { sandboxConfig, sandboxHost, sandboxRequested } from "./lib/agent-api/sandbox/config";
import { productSiteOrigin } from "./concept/site/origin";
import { siteRequestHost } from "./concept/site/request-host";
import { galleryAvailable } from "./concept/server/gallery";
import { conceptRoute } from "./concept/page/language";
import { isProductHome, routeHost, UNKNOWN_PATH, type HostRoute } from "./concept/page/resolve";

/** Consume the explicit demo link before rendering, so the first studio document uses the saved preference. */
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
    if (studio && !parseLocale(request.cookies.get(LOCALE_COOKIE)?.value)) setLocaleCookie(response, language);
    setDemoVisitorCookie(response, language);
  }
  return response;
}

/**
 * One deployment, several addresses: the product domain shows the coming-soon page, its demo
 * subdomain the studio, a business's own address (subdomain or own domain) its booking
 * page, and an address that leads nowhere the friendly page.
 */
function hostResponse(request: NextRequest, host: string | null | undefined, route: HostRoute) {
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

export function proxy(request: NextRequest) {
  if (sandboxRequested()) return sandboxProxy(request);
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
  const response = publicReadonlyResponse(request) ?? hostResponse(request, host, route);
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
    if (sandboxHost(request, origin) &&
        (/^\/api\/v1\/(?:access|services|availability|(?:proposals|bookings)(?:\/[a-zA-Z0-9_-]{1,128})?)$/.test(path) ||
         path.startsWith("/_next/static/"))) {
      const response = NextResponse.next();
      response.headers.set("X-Robots-Tag", "noindex, nofollow");
      return response;
    }
    return new NextResponse(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  } catch {
    return new NextResponse(null, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export const config = { matcher: "/:path*" };
