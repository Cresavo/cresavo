import { withRequestLog } from "@/concept/server/logger";
import { publicReadonlyResponse } from "@/lib/public-readonly";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The demo has no server-side owner identity or business-to-domain ownership.
// All domain setup stays simulated until both can be verified, and until a
// verified host's slug reaches the directory `routeHost` reads
// (`page/directory.ts`): otherwise the studio would report a live address
// that the proxy answers with the unknown-address page.
const simulated = () => Response.json({ enabled: false }, { headers: { "Cache-Control": "no-store" } });

export const GET = withRequestLog("/api/concept/domains", simulated);
export const POST = withRequestLog("/api/concept/domains", (request: Request) => publicReadonlyResponse(request) ?? simulated());
export const PATCH = POST;
export const DELETE = POST;
