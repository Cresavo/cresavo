import { z } from "zod";
import { connectDomain, disconnectDomain, domainsConfig, domainStatus } from "@/concept/server/vercel-domains";
import { createRateLimiter } from "@/concept/server/rate-limit";
import { withRequestLog } from "@/concept/server/logger";
import { publicReadonlyResponse } from "@/lib/public-readonly";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Own domains through the Vercel Domains API. Off by default: every call then
// answers `{ enabled: false }` and the studio simulates the steps instead.
// Like the other demo endpoints it has no login (issue #14), so switch it on
// only after real authentication exists.

const take = createRateLimiter({ max: 30, windowMs: 60_000 });
const body = z.object({ host: z.string().max(253) }).strict();
const noStore = { "Cache-Control": "no-store" };

function guard(request: Request) {
  const blocked = publicReadonlyResponse(request);
  if (blocked) return blocked;
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "Invalid origin" }, { status: 403 });
  const limit = take("domains");
  if (!limit.ok) return Response.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
}

async function respond(request: Request, run: (host: string) => ReturnType<typeof connectDomain>) {
  const blocked = guard(request);
  if (blocked) return blocked;
  if (!domainsConfig()) return Response.json({ enabled: false }, { headers: noStore });
  const input = body.safeParse(await request.json().catch(() => null));
  if (!input.success) return Response.json({ error: "Invalid domain" }, { status: 400, headers: noStore });
  const result = await run(input.data.host);
  if (result.ok) return Response.json({ enabled: true, status: result.status }, { headers: noStore });
  return Response.json({ enabled: true, error: result.error }, { status: result.error === "invalid" ? 400 : 502, headers: noStore });
}

export const GET = withRequestLog("/api/concept/domains", () => Response.json({ enabled: !!domainsConfig() }, { headers: noStore }));
/** Adds the domain if needed and reports its status. */
export const POST = withRequestLog("/api/concept/domains", (request: Request) => respond(request, (host) => connectDomain(host)));
export const PATCH = withRequestLog("/api/concept/domains", (request: Request) => respond(request, (host) => domainStatus(host)));
export const DELETE = withRequestLog("/api/concept/domains", (request: Request) => respond(request, (host) => disconnectDomain(host)));
