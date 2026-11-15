import { oauth } from "@/lib/agent-api/oauth/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) { return oauth(request, "authorize"); }
