import { isPublicReadonly, readonlyForbidden } from "@/lib/public-readonly";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requestId } from "@/lib/admin-http";
import { listServices } from "@/lib/domain";
import { saveService } from "@/lib/workspace-config";
import { failure } from "@/lib/http";
export async function GET() {
  if (isPublicReadonly()) return readonlyForbidden();
  try {
    await requireAdmin();
    return NextResponse.json(await listServices(true), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: NextRequest) {
  if (isPublicReadonly()) return readonlyForbidden();
  try {
    const actor = await requireAdmin(true);
    const result = await saveService(
      await request.json(),
      requestId(request.headers),
      actor,
    );
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return failure(error);
  }
}
