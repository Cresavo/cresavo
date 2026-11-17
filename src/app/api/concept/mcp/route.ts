import { handleConceptMcp } from "@/concept/server/mcp";
import { withRequestLog } from "@/concept/server/logger";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** HTTP MCP for the demo business. Bearer token from CONCEPT_MCP_TOKEN; write tools only create proposals. */
const endpoint = withRequestLog("/api/concept/mcp", (request: Request, _context: unknown, log) => handleConceptMcp(request, log));
export const POST = endpoint;
export const GET = endpoint;
export const DELETE = endpoint;
