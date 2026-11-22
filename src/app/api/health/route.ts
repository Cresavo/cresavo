import { NextResponse } from "next/server";
import { version } from "../../../../package.json";

// Liveness for an uptime monitor. It reveals the release and nothing else, and
// never touches the database unless HEALTH_CHECK_DB=1.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DB_TIMEOUT_MS = 1500;
const headers = { "Cache-Control": "no-store" };

async function databaseUp(): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const { db } = await import("@/lib/db");
    await Promise.race([
      db.$queryRaw`SELECT 1`,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("timeout")), DB_TIMEOUT_MS); }),
    ]);
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  if (process.env.HEALTH_CHECK_DB !== "1") return NextResponse.json({ ok: true, version }, { headers });
  const ok = await databaseUp();
  return NextResponse.json({ ok, version }, { status: ok ? 200 : 503, headers });
}
