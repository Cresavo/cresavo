import { isPublicReadonly, readonlyForbidden } from "@/lib/public-readonly";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, requestId } from "@/lib/admin-http";
import { createBooking, adminBookingSchema } from "@/lib/domain";
import {
  bookingSummary,
  moveBooking,
  moveBookingSchema,
  cancelBooking,
  cancelBookingSchema,
} from "@/lib/booking-mutations";
import { listCalendar } from "@/lib/calendar";
import { failure } from "@/lib/http";

const actionSchema = z.discriminatedUnion("action", [
  adminBookingSchema.safeExtend({ action: z.literal("create") }).strict(),
  moveBookingSchema.extend({ action: z.literal("move") }).strict(),
  cancelBookingSchema.extend({ action: z.literal("cancel") }).strict(),
]);
export async function GET(request: NextRequest) {
  if (isPublicReadonly()) return readonlyForbidden();
  try {
    await requireAdmin();
    const params = request.nextUrl.searchParams;
    const value = {
      ...Object.fromEntries(params),
      limit: params.has("limit") ? Number(params.get("limit")) : 100,
    };
    return NextResponse.json(await listCalendar(value), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: NextRequest) {
  if (isPublicReadonly()) return readonlyForbidden();
  try {
    const actor = await requireAdmin(true),
      key = requestId(request.headers);
    const { action, ...input } = actionSchema.parse(await request.json());
    const result =
      action === "create"
        ? bookingSummary(await createBooking(input, key, undefined, actor))
        : action === "move"
          ? await moveBooking(input, key, actor)
          : await cancelBooking(input, key, actor);
    return NextResponse.json(result, {
      status: action === "create" ? 201 : 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return failure(error);
  }
}
