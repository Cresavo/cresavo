import { NextResponse } from "next/server";
import { safeFailure } from "./errors";

export function failure(error: unknown) {
  const { status, message } = safeFailure(error);
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}
