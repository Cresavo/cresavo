import { NextRequest, NextResponse } from "next/server";
import { checkPassword, login, sameOrigin } from "@/lib/auth";
import { failure } from "@/lib/http";
import { clientIp, recordFailedLogin } from "@/lib/rate-limit";

export async function POST(r: NextRequest) {
  if (!(await sameOrigin()))
    return NextResponse.json({ error: "Otillåtet ursprung" }, { status: 403 });
  try {
    const ip = clientIp(r.headers);
    const v = await r.json();
    if (!v || typeof v.password !== "string" || !checkPassword(v.password)) {
      await recordFailedLogin(ip);
      return NextResponse.json({ error: "Fel lösenord" }, { status: 401 });
    }
    // A correct password is never rejected because another client shares this address.
    await login();
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
