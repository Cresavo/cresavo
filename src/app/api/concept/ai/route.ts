import { describeAi } from "@/concept/ai/overview";
import { canStoreKey, removeBusinessKey, saveBusinessKey, settingsInput } from "@/concept/ai/business-settings";
import { DEMO_BUSINESS, updateBusinessAi } from "@/concept/ai/demo-store";
import { demoWriteLimited } from "@/concept/server/demo-write-limit";
import { withRequestLog } from "@/concept/server/logger";
import { fromSameOrigin } from "@/concept/server/same-origin";
import { publicReadonlyResponse } from "@/lib/public-readonly";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The demo has one server-selected business, never a client-supplied tenant ID.
// Mutations are unauthenticated demo endpoints (see issue #14 before any hosted use).
const describe = () => Response.json(describeAi(), { headers: { "Cache-Control": "no-store" } });

function mutationGuard(request: Request) {
  const blocked = publicReadonlyResponse(request);
  if (blocked) return blocked;
  if (!fromSameOrigin(request)) return Response.json({ error: "Invalid origin" }, { status: 403 });
  return demoWriteLimited(request);
}

/** Task list with provider/model and the cost log. No keys, no payloads. */
export const GET = withRequestLog("/api/concept/ai", describe);

export const PUT = withRequestLog("/api/concept/ai", async (request: Request) => {
  const blocked = mutationGuard(request);
  if (blocked) return blocked;
  try {
    const input = settingsInput.safeParse(await request.json());
    if (!input.success) return Response.json({ error: "Invalid AI settings" }, { status: 400 });
    if ("key" in input.data) {
      if (!canStoreKey()) return Response.json({ error: "Key storage unavailable" }, { status: 503 });
      saveBusinessKey(DEMO_BUSINESS, input.data.provider, input.data.key);
    } else {
      const { task, tier } = input.data;
      updateBusinessAi(DEMO_BUSINESS, (data) => { data.tiers[task] = tier; });
    }
    return describe();
  } catch {
    return Response.json({ error: "Unable to save AI settings" }, { status: 400 });
  }
});

export const DELETE = withRequestLog("/api/concept/ai", (request: Request) => {
  const blocked = mutationGuard(request);
  if (blocked) return blocked;
  removeBusinessKey();
  return describe();
});
