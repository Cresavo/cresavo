import { isPublicReadonly, readonlyForbidden } from "@/lib/public-readonly";
import { NextRequest, NextResponse } from "next/server";
import { login, sameOrigin } from "@/lib/auth";
import { verifyAdminCredentials } from "@/lib/admin-accounts";
import { failure } from "@/lib/http";
import { clientIp, checkLoginAttempt } from "@/lib/rate-limit";

export async function POST(r: NextRequest) {
  if (isPublicReadonly()) return readonlyForbidden();
  if (!(await sameOrigin()))
    return NextResponse.json({ error: "Otillåtet ursprung" }, { status: 403 });
  try {
    const ip = clientIp(r.headers);
    const v = await r.json();
    if (
      !(await checkLoginAttempt(ip, async () => {
        const identity = await verifyAdminCredentials(v);
        return !!identity && (await login(identity));
      }))
    ) {
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
