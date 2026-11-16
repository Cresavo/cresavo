import { describeAi } from "@/concept/ai/overview";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Task list with provider/model and the process-local cost log. No keys, no payloads. */
export function GET() {
  return Response.json(describeAi());
}
