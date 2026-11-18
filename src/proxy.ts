import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isPublicReadonly, publicReadonlyResponse } from "./lib/public-readonly";
import { COMING_SOON_PATH, routeHost, UNKNOWN_PATH } from "./concept/page/resolve";

/**
 * One deployment, several addresses: the product domain shows the coming-soon page, its demo
 * subdomain the demo landing, a business's own address (subdomain or own domain) its booking
 * page, and an address that leads nowhere the friendly page.
 */
function hostResponse(request: NextRequest) {
  const host = request.headers.get("host");
  const route = routeHost(host, request.nextUrl.pathname, undefined, undefined, process.env.LEGACY_HOME === "1");
  if (route.action === "next") return;
  const url = request.nextUrl.clone();
  url.pathname = route.path;
  url.search = route.path === UNKNOWN_PATH ? `?host=${encodeURIComponent((host ?? "").slice(0, 100))}` : request.nextUrl.search;
  // The product domain's front page is the one page of the read-only demo deployment that search engines may list.
  return { response: NextResponse.rewrite(url), indexable: route.path === COMING_SOON_PATH };
}

export function proxy(request: NextRequest) {
  const routed = hostResponse(request);
  const response = publicReadonlyResponse(request) ?? routed?.response ?? NextResponse.next();
  if (isPublicReadonly() && !routed?.indexable) response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
