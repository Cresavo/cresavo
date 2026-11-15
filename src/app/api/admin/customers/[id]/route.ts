import { isPublicReadonly, readonlyForbidden } from "@/lib/public-readonly";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-http";
import { getCustomer, customerBookings } from "@/lib/customers";
import { failure } from "@/lib/http";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (isPublicReadonly()) return readonlyForbidden();
  try {
    const actor = await requireAdmin(),
      { id } = await context.params;
    const query = request.nextUrl.searchParams;
    const customer = await getCustomer(id, actor);
    const history = await customerBookings(
      id,
      {
        ...Object.fromEntries(query),
        ...(query.has("limit") && { limit: Number(query.get("limit")) }),
      },
      actor,
    );
    return NextResponse.json(
      { customer, ...history },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
