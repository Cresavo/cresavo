import { metadata } from "@/lib/agent-api/oauth/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET() { return metadata("resource"); }
