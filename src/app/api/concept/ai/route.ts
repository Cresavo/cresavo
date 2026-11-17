import { describeAi } from "@/concept/ai/overview";
import { withRequestLog } from "@/concept/server/logger";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Task list with provider/model and the process-local cost log. No keys, no payloads. */
export const GET = withRequestLog("/api/concept/ai", () => Response.json(describeAi()));
