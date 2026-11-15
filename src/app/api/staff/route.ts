import { NextRequest, NextResponse } from "next/server";
import { listStaff } from "@/lib/workspace-config";
import { failure } from "@/lib/http";
export async function GET(request: NextRequest) {
  try {
    const rows = await listStaff(
      request.nextUrl.searchParams.get("serviceId") ?? undefined,
    );
    return NextResponse.json(
      rows.map(({ id, name, serviceIds }) => ({ id, name, serviceIds })),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
