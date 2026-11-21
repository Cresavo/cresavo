import { z } from "zod";
import { renderPosterSvg } from "@/concept/campaigns/poster-engine/render";
import { ENGINE_FORMATS, ENGINE_TEMPLATES, posterDataSchema } from "@/concept/campaigns/poster-engine/templates";
import { withRequestLog } from "@/concept/server/logger";
import { createRateLimiter } from "@/concept/server/rate-limit";
import { fromSameOrigin } from "@/concept/server/same-origin";
import { waitlistClientKey } from "@/concept/site/waitlist-server";
export const runtime = "nodejs";

// Renders one poster as SVG for the studio. Same-origin only and rate-limited:
// rendering costs CPU, and the photos in the body are a few megabytes at most.

const MAX_BODY = 6_000_000;
const takeRender = createRateLimiter({ max: 120, windowMs: 60_000 });
const requestSchema = z.object({
  template: z.enum(ENGINE_TEMPLATES),
  format: z.enum(Object.keys(ENGINE_FORMATS) as [keyof typeof ENGINE_FORMATS, ...(keyof typeof ENGINE_FORMATS)[]]),
  data: posterDataSchema,
}).strict();

const json = (body: Record<string, unknown>, status: number, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });

export const POST = withRequestLog("/api/concept/poster", async (request: Request) => {
  // Open on the read-only public demo too (see publicReadonlyResponse): rendering stores nothing.
  if (!fromSameOrigin(request)) return json({ error: "forbidden_origin" }, 403);
  const limit = takeRender(waitlistClientKey(request.headers));
  if (!limit.ok) return json({ error: "rate_limited" }, 429, { "Retry-After": String(limit.retryAfter) });
  const body = await request.text();
  if (body.length > MAX_BODY) return json({ error: "too_large" }, 413);
  let parsed;
  try {
    parsed = requestSchema.safeParse(JSON.parse(body));
  } catch {
    return json({ error: "invalid" }, 400);
  }
  if (!parsed.success) return json({ error: "invalid" }, 400);
  try {
    const svg = await renderPosterSvg(parsed.data.template, parsed.data.data, parsed.data.format);
    return new Response(svg, { headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return json({ error: "render_failed" }, 500);
  }
});
