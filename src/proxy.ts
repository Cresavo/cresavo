import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isPublicReadonly, publicReadonlyResponse } from "./lib/public-readonly";
import { siteRequestHost } from "./concept/site/request-host";
import { isProductHome, routeHost, UNKNOWN_PATH } from "./concept/page/resolve";

/**
 * One deployment, several addresses: the product domain shows the coming-soon page, its demo
 * subdomain the demo landing, a business's own address (subdomain or own domain) its booking
 * page, and an address that leads nowhere the friendly page.
 */
function hostResponse(request: NextRequest, host: string | null | undefined) {
  const route = routeHost(host, request.nextUrl.pathname, undefined, undefined, process.env.LEGACY_HOME === "1");
  if (route.action === "next") return;
  const url = request.nextUrl.clone();
  url.pathname = route.path;
  url.search = route.path === UNKNOWN_PATH ? `?host=${encodeURIComponent((host ?? "").slice(0, 100))}` : request.nextUrl.search;
  return NextResponse.rewrite(url);
}

export function proxy(request: NextRequest) {
  const host = siteRequestHost((name) => request.headers.get(name));
  const response = publicReadonlyResponse(request) ?? hostResponse(request, host) ?? NextResponse.next();
  if (isPublicReadonly() && !isProductHome(host, request.nextUrl.pathname)) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
