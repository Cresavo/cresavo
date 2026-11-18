import { DEMO_BUSINESS } from "@/concept/ai/demo-store";
import { describeConnections } from "@/concept/connections/server/overview";
import { withRequestLog } from "@/concept/server/logger";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Which adapter each port uses and why. Secret names only, never values. */
export const GET = withRequestLog("/api/concept/connections", async () =>
  Response.json(await describeConnections(DEMO_BUSINESS), { headers: { "Cache-Control": "no-store" } }));
