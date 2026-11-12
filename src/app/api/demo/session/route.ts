import { NextRequest, NextResponse } from "next/server";
import { demoAccessEnabled, DEMO_ADMIN_EMAIL } from "@/lib/demo-access";
import { getAdminContext, login, sameOrigin } from "@/lib/auth";
import { db } from "@/lib/db";
import { clientIp, checkLoginAttempt } from "@/lib/rate-limit";
import { DEMO_BUSINESS_ID } from "@/lib/config";
import { failure } from "@/lib/http";

export async function POST(request: NextRequest) {
  if (!demoAccessEnabled() || !(await sameOrigin()))
    return NextResponse.json(
      { error: "Demoåtkomst är inte tillgänglig." },
      { status: 403 },
    );
  try {
    const ip = clientIp(request.headers); // Requires the supported, signed wrapper.
    if (await getAdminContext()) return NextResponse.json({ ok: true });
    const accepted = await checkLoginAttempt(ip, async () => {
      const actor = await db.adminUser.findUnique({
        where: { email: DEMO_ADMIN_EMAIL },
      });
      if (!actor?.active || actor.businessId !== DEMO_BUSINESS_ID) return false;
      return login({
        id: actor.id,
        credentialVersion: actor.credentialVersion,
      });
    });
    return NextResponse.json(
      accepted ? { ok: true } : { error: "Demoåtkomst är inte tillgänglig." },
      {
        status: accepted ? 200 : 403,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    return failure(error);
  }
}
