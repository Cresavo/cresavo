import { NextRequest, NextResponse } from "next/server";
import { checkPassword, login, sameOrigin } from "@/lib/auth";
import { failure } from "@/lib/http";
import { checkRateLimit, clientIp, recordFailedLogin } from "@/lib/rate-limit";

export async function POST(r: NextRequest) {
  if (!(await sameOrigin()))
    return NextResponse.json({ error: "Otillåtet ursprung" }, { status: 403 });
  try {
    const ip = clientIp(r.headers);
    checkRateLimit("login", ip, false);
    const v = await r.json();
    if (!v || typeof v.password !== "string" || !checkPassword(v.password)) {
      recordFailedLogin(ip);
      return NextResponse.json({ error: "Fel lösenord" }, { status: 401 });
    }
    await login();
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
