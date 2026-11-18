import { CONCEPT_PATHS } from "@/concept/server/discovery";
import { withRequestLog } from "@/concept/server/logger";
import { DEV_TOKEN, tokenSource } from "@/concept/server/token";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** What More > Your data & AI shows about the protocols. Never returns a configured token, only the public development one. */
export const GET = withRequestLog("/api/concept/protocols", () => {
  const token = tokenSource();
  return Response.json({ paths: CONCEPT_PATHS, mcp: { token, devToken: token === "dev-default" ? DEV_TOKEN : undefined } }, { headers: { "Cache-Control": "no-store" } });
});
