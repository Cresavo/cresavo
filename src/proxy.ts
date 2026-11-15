import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { publicReadonlyResponse } from "./lib/public-readonly";

export function proxy(request: NextRequest) {
  return publicReadonlyResponse(request) ?? NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
