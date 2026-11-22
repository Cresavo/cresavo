import type { NextRequest } from "next/server";
import { ownerError, ownerOk, ownerRoute } from "@/lib/owner-http";
import { ownerFromCookie, OWNER_COOKIE } from "@/lib/owner-session";
import { ownerStore } from "@/lib/owner-store";

/**
 * The signed-in owner's salon and its version. The document carries every
 * journal, so a load of a salon with journal entries is logged as a read of all
 * of them (`journal/view` without a customer; the log is in `journalAccess`).
 * A load within ten minutes of the last one is not logged again.
 */
export function GET(request: NextRequest) {
  return ownerRoute(request, async () => {
    const owner = await ownerFromCookie(request.cookies.get(OWNER_COOKIE)?.value);
    if (!owner) return ownerError("signed_out", 401);
    const store = ownerStore();
    const loaded = await store.load(owner.tenantId);
    if (!loaded) return ownerError("not_found", 404);
    if (!loaded.state.journals.length) return ownerOk({ state: loaded.state, version: loaded.version });
    // "rejected" means a load was just logged; "conflict" that the salon is busy and the next load will log it.
    const logged = await store.apply(owner.tenantId, { type: "journal/view", actor: "owner" }, { actor: "owner", source: "button" });
    if (logged.ok) return ownerOk({ state: logged.state, version: logged.version });
    return ownerOk({ state: loaded.state, version: loaded.version });
  }, { write: false });
}
