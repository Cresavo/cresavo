import { receptionistStatus } from "@/concept/receptionist/server/config";
import { withRequestLog } from "@/concept/server/logger";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Whether the phone receptionist is switched on for this deployment, and its call ceiling. No keys. */
export const GET = withRequestLog("/api/concept/receptionist", () =>
  Response.json(receptionistStatus(), { headers: { "Cache-Control": "no-store" } }));
