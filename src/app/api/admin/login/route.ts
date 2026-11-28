import { isPublicReadonly, readonlyForbidden } from "@/lib/public-readonly";
import { NextRequest, NextResponse } from "next/server";
import { login, sameOrigin } from "@/lib/auth";
import { verifyAdminCredentials } from "@/lib/admin-accounts";
import { failure } from "@/lib/http";
import { clientIp, checkLoginAttempt } from "@/lib/rate-limit";
import { LOGIN_MAX_BODY_BYTES, readBoundedBytes } from "@/lib/bounded-json";

export async function POST(r: NextRequest) {
  if (isPublicReadonly()) return readonlyForbidden();
  if (!(await sameOrigin()))
    return NextResponse.json({ error: "Otillåtet ursprung" }, { status: 403 });
  try {
    const ip = clientIp(r.headers);
    let tooLarge = false;
    if (
      !(await checkLoginAttempt(ip, async () => {
        const body = await readBoundedBytes(r, LOGIN_MAX_BODY_BYTES);
        if (body === "too_large") { tooLarge = true; return false; }
        const v: unknown = JSON.parse(new TextDecoder().decode(body));
        const identity = await verifyAdminCredentials(v);
        return !!identity && (await login(identity));
      }))
    ) {
      if (tooLarge) return NextResponse.json({ error: "too_large" }, { status: 413 });
      return NextResponse.json(
        { error: "Fel inloggningsuppgifter" },
        { status: 401 },
      );
    }
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
