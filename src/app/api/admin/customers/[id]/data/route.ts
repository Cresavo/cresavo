import { isPublicReadonly, readonlyForbidden } from "@/lib/public-readonly";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, requestId } from "@/lib/admin-http";
import {
  customerDataSchema,
  customerExportSchema,
  customerContactRemovalSchema,
  exportCustomerData,
  previewCustomerContactRemoval,
  removeCustomerContact,
} from "@/lib/customer-data";
import { failure } from "@/lib/http";

const action = z.discriminatedUnion("action", [
  customerDataSchema
    .omit({ id: true })
    .extend({ action: z.literal("preview_removal") }),
  customerExportSchema
    .omit({ id: true })
    .extend({ action: z.literal("export") }),
  customerContactRemovalSchema
    .omit({ id: true })
    .extend({ action: z.literal("remove_contact") }),
]);
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (isPublicReadonly()) return readonlyForbidden();
  try {
    const actor = await requireAdmin(true),
      { id } = await context.params;
    const { action: kind, ...input } = action.parse(await request.json());
    const value = { ...input, id };
    const result =
      kind === "export"
        ? await exportCustomerData(value, actor)
        : kind === "preview_removal"
          ? await previewCustomerContactRemoval(value, actor)
          : await removeCustomerContact(value, requestId(request.headers), actor);
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store",
        ...(kind === "export" && {
          "Content-Disposition":
            'attachment; filename="booking-lab-kunddata.json"',
        }),
      },
    });
  } catch (error) {
    return failure(error);
  }
}
