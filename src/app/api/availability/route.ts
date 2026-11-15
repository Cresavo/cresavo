import { NextRequest, NextResponse } from "next/server";
import { getAvailability } from "@/lib/domain";
import { failure } from "@/lib/http";
import { db } from "@/lib/db";
export async function GET(r: NextRequest) {
  try {
    return NextResponse.json(
      await getAvailability(
        r.nextUrl.searchParams.get("serviceId") ?? "",
        r.nextUrl.searchParams.get("date") ?? "",
        db,
        r.nextUrl.searchParams.get("staffId") ?? "staff-demo",
      ),
    );
  } catch (e) {
    return failure(e);
  }
}
