import { isPublicReadonly, readonlyForbidden } from "@/lib/public-readonly";
import { NextResponse } from "next/server";
import { logout, sameOrigin } from "@/lib/auth";
import { failure } from "@/lib/http";

export async function POST() {
  if (isPublicReadonly()) return readonlyForbidden();
  if (!(await sameOrigin()))
    return NextResponse.json({ error: "Otillåtet ursprung" }, { status: 403 });
  try {
    await logout();
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
