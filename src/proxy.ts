import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isPublicReadonly, publicReadonlyResponse } from "./lib/public-readonly";
import { routeHost, UNKNOWN_PATH } from "./concept/page/resolve";

/** A business's own address (subdomain or own domain) serves its booking page; an address that leads nowhere gets the friendly page. */
function hostResponse(request: NextRequest) {
  const host = request.headers.get("host");
  const route = routeHost(host, request.nextUrl.pathname);
  if (route.action === "next") return;
  const url = request.nextUrl.clone();
  url.pathname = route.path;
  url.search = route.path === UNKNOWN_PATH ? `?host=${encodeURIComponent((host ?? "").slice(0, 100))}` : request.nextUrl.search;
  return NextResponse.rewrite(url);
}

export function proxy(request: NextRequest) {
  const response = publicReadonlyResponse(request) ?? hostResponse(request) ?? NextResponse.next();
  if (isPublicReadonly()) response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
