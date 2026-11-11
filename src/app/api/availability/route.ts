import { NextRequest, NextResponse } from "next/server";
import { getAvailability } from "@/lib/domain";
import { failure } from "@/lib/http";
export async function GET(r: NextRequest) {
  try {
    return NextResponse.json(
      await getAvailability(
        r.nextUrl.searchParams.get("serviceId") ?? "",
        r.nextUrl.searchParams.get("date") ?? "",
      ),
    );
  } catch (e) {
    return failure(e);
  }
}
