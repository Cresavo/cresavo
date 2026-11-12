import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, requestId } from "@/lib/admin-http";
import {
  createCustomer,
  editCustomer,
  listCustomers,
  customerCreateSchema,
  customerEditSchema,
} from "@/lib/customers";
import { failure } from "@/lib/http";

const actionSchema = z.discriminatedUnion("action", [
  customerCreateSchema.extend({ action: z.literal("create") }),
  customerEditSchema.extend({ action: z.literal("edit") }),
]);
export async function GET(request: NextRequest) {
  try {
    const actor = await requireAdmin(),
      params = request.nextUrl.searchParams;
    return NextResponse.json(
      await listCustomers(
        {
          ...Object.fromEntries(params),
          ...(params.has("limit") && { limit: Number(params.get("limit")) }),
        },
        actor,
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: NextRequest) {
  try {
    const actor = await requireAdmin(true),
      key = requestId(request.headers);
    const { action, ...input } = actionSchema.parse(await request.json());
    return NextResponse.json(
      await (action === "create" ? createCustomer : editCustomer)(
        input,
        key,
        actor,
      ),
      {
        status: action === "create" ? 201 : 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    return failure(error);
  }
}
