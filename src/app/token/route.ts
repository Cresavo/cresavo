import { oauth } from "@/lib/agent-api/oauth/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function POST(request: Request) { return oauth(request, "token"); }
