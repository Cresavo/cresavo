import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requestId } from "@/lib/admin-http";
import { decideCapacity, inspectCapacity, listCapacity } from "@/lib/capacity";
import { failure } from "@/lib/http";
import { z } from "zod";

const action = z
  .object({
    action: z.enum(["calendar", "preview", "dismiss", "draft"]),
    input: z.unknown(),
  })
  .strict();
const headers = { "Cache-Control": "no-store" };
export async function GET(request: NextRequest) {
  try {
    const actor = await requireAdmin(),
      params = request.nextUrl.searchParams;
    return NextResponse.json(
      await listCapacity(
        {
          ...Object.fromEntries(params),
          ...(params.has("days") && { days: Number(params.get("days")) }),
          ...(params.has("limit") && { limit: Number(params.get("limit")) }),
        },
        actor,
      ),
      { headers },
    );
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: NextRequest) {
  try {
    const actor = await requireAdmin(true);
    const v = action.parse(await request.json());
    const result =
      v.action === "calendar" || v.action === "preview"
        ? await inspectCapacity(v.input, actor, v.action === "preview")
        : await decideCapacity(
            v.input,
            requestId(request.headers),
            actor,
            v.action,
          );
    return NextResponse.json(result, { headers });
  } catch (error) {
    return failure(error);
  }
}
