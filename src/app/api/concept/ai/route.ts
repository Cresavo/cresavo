import { describeAi } from "@/concept/ai/overview";
import { canStoreKey, removeBusinessKey, saveBusinessKey, settingsInput } from "@/concept/ai/business-settings";
import { DEMO_BUSINESS, updateBusinessAi } from "@/concept/ai/demo-store";
import { publicReadonlyResponse } from "@/lib/public-readonly";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The demo has one server-selected business, never a client-supplied tenant ID.
export function GET() { return Response.json(describeAi(), { headers: { "Cache-Control": "no-store" } }); }
function mutationGuard(request: Request) {
  const blocked = publicReadonlyResponse(request);
  if (blocked) return blocked;
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "Invalid origin" }, { status: 403 });
}
export async function PUT(request: Request) {
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
      updateBusinessAi(DEMO_BUSINESS, data => { data.tiers[task] = tier; });
    }
    return GET();
  } catch { return Response.json({ error: "Unable to save AI settings" }, { status: 400 }); }
}
export function DELETE(request: Request) {
  const blocked = mutationGuard(request);
  if (blocked) return blocked;
  removeBusinessKey();
  return GET();
}
