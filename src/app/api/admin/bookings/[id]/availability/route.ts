import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-http";
import { getMoveAvailability } from "@/lib/booking-mutations";
import { failure } from "@/lib/http";
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    const { id } = await context.params;
    return NextResponse.json(
      await getMoveAvailability(
        id,
        request.nextUrl.searchParams.get("date") ?? "",
        request.nextUrl.searchParams.get("staffId") ?? "",
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
