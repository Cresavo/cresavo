import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-http";
import { getBooking } from "@/lib/booking-mutations";
import { failure } from "@/lib/http";
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    return NextResponse.json(await getBooking(id, true), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return failure(error);
  }
}
