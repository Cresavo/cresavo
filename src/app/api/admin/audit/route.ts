import { requireAdmin } from "@/lib/admin-http";
import { failure } from "@/lib/http";
import { readAudit } from "@/lib/agent-api/audit-read";
export async function GET(request: Request) {
  try {
    await requireAdmin();
    return Response.json(await readAudit(Object.fromEntries(new URL(request.url).searchParams)), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}
