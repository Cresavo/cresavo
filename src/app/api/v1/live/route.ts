import { NextResponse } from "next/server";
import { liveSnapshot } from "@/lib/agent-api/live";
export async function GET() {
  try {
    return NextResponse.json(await liveSnapshot(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    console.error("AGENT_LIVE_FAILED");
    return NextResponse.json({ error: { code: "internal_error" } }, { status: 500 });
  }
}
