import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";
import { createBooking } from "@/lib/domain";
import { failure } from "@/lib/http";
import { sameOrigin } from "@/lib/auth";
export async function POST(r: NextRequest) {
  if (!(await sameOrigin()))
    return NextResponse.json({ error: "Otillåtet ursprung" }, { status: 403 });
  try {
    const ip = clientIp(r.headers);
    let input;
    try {
      input = await r.json();
    } catch (error) {
      await checkRateLimit("bookings", ip);
      throw error;
    }
    const b = await createBooking(
      input,
      r.headers.get("Idempotency-Key") ?? undefined,
      ip,
    );
    return NextResponse.json({ id: b.id }, { status: 201 });
  } catch (e) {
    return failure(e);
  }
}
