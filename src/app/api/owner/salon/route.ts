import { NextResponse, type NextRequest } from "next/server";
import { ownerError, ownerOk, ownerRoute, signedInOwner, withRenewedSession } from "@/lib/owner-http";
import { ownerStore } from "@/lib/owner-store";

/**
 * The signed-in owner's salon and its version. The document carries every
 * journal, so a load of a salon with journal entries is logged as a read of all
 * of them (`journal/view` without a customer; the log is in `journalAccess`).
 * A load within ten minutes of the last one is not logged again.
 */
export function GET(request: NextRequest) {
  return ownerRoute(request, async () => {
    const owner = await signedInOwner(request);
    if (owner instanceof NextResponse) return owner;
    const store = ownerStore();
    const loaded = await store.load(owner.tenantId);
    if (!loaded) return ownerError("not_found", 404);
    const holdsJournals = loaded.state.journals.length > 0 || loaded.state.trash.some((entry) => entry.kind === "customer" && entry.journals.length > 0);
    if (!holdsJournals) return withRenewedSession(ownerOk({ state: loaded.state, version: loaded.version }), request);
    const logged = await store.apply(owner.tenantId, { type: "journal/view", actor: "owner" }, { actor: "owner", source: "button" });
    if (logged.ok) return withRenewedSession(ownerOk({ state: logged.state, version: logged.version }), request);
    // Only a load logged a moment ago is refused without a detail. Any other refusal (a busy salon, a full document) means this load is not on the log, so it is not served.
    if (logged.reason === "rejected" && !logged.detail) return withRenewedSession(ownerOk({ state: loaded.state, version: loaded.version }), request);
    return ownerError("unavailable", 503);
  }, { write: false });
}
