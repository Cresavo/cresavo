import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isPublicReadonly, publicReadonlyResponse } from "./lib/public-readonly";

export function proxy(request: NextRequest) {
  const response = publicReadonlyResponse(request) ?? NextResponse.next();
  if (isPublicReadonly()) response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
