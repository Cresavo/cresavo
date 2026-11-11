import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { createBooking } from "@/lib/domain";
import { failure } from "@/lib/http";
import { sameOrigin } from "@/lib/auth";
export async function POST(r: NextRequest) {
  if (!(await sameOrigin()))
    return NextResponse.json({ error: "Otillåtet ursprung" }, { status: 403 });
  try {
    checkRateLimit("bookings", clientIp(r.headers));
    const b = await createBooking(
      await r.json(),
      r.headers.get("Idempotency-Key") ?? undefined,
    );
    return NextResponse.json({ id: b.id }, { status: 201 });
  } catch (e) {
    return failure(e);
  }
}
