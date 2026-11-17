import { discoveryOrigin } from "@/lib/agent-api/discovery";
import { handleConceptA2a } from "@/concept/server/a2a";
import { withRequestLog } from "@/concept/server/logger";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A2A JSON-RPC (SendMessage only, read-only) for a customer's assistant. */
export const POST = withRequestLog("/api/concept/a2a", (request: Request) => {
  let origin: string;
  try {
    origin = discoveryOrigin();
  } catch {
    return Response.json({ error: "DISCOVERY_CONFIG_INVALID" }, { status: 503 });
  }
  return handleConceptA2a(request, origin);
});
