import type { NextRequest } from "next/server";
import { holdsJournalText, withoutJournalText } from "@/concept/journals/sealed";
import { ownerError, ownerOk, ownerRoute, fullOwner, refusedOwner, sessionKey, sessionOwner, withRenewedSession } from "@/lib/owner-http";
import { journalsOnServer } from "@/lib/owner-journals";
import { ownerStore } from "@/lib/owner-store";

/**
 * The signed-in owner's salon and its version. The document carries every
 * journal, so a load of a salon with journal entries is logged as a read of all
 * of them (`journal/view` without a customer; the log is in `journalAccess`).
 * A load within ten minutes of the last one is not logged again.
 *
 * With server-side journals (JOURNALS_ON_SERVER=1) the document carries stubs
 * only: text still in it moves into the table first (once, under the row lock),
 * nothing is logged here, and each customer's journal is read and logged through
 * `/api/owner/journals`. Without a key the salon is served without journal text.
 */
export function GET(request: NextRequest) {
  return ownerRoute(request, async () => {
    const owner = await sessionOwner(request);
    if (!fullOwner(owner)) return refusedOwner(owner);
    const store = ownerStore();
    const loaded = await store.load(owner.tenantId);
    if (!loaded) return ownerError("not_found", 404);
    if (journalsOnServer()) {
      let current = loaded;
      // Until the salon is marked, its replays or old audit rows may still hold journal text: the move finishes first.
      if (holdsJournalText(loaded.state) || !(await store.journalsSealed(owner.tenantId))) {
        const sealed = await store.sealJournals(owner.tenantId);
        if (!sealed.ok && sealed.reason === "conflict") return ownerError("unavailable", 503);
        current = (sealed.ok && sealed.changed ? await store.load(owner.tenantId) : null) ?? loaded;
      }
      // `session` binds the studio's journal requests and its cache to this session (`x-cresavo-session`).
      return withRenewedSession(ownerOk({ state: withoutJournalText(current.state), version: current.version, journals: "server", session: sessionKey(owner) }), request);
    }
    const session = sessionKey(owner);
    const holdsJournals = loaded.state.journals.length > 0 || loaded.state.trash.some((entry) => entry.kind === "customer" && entry.journals.length > 0);
    if (!holdsJournals) return withRenewedSession(ownerOk({ state: loaded.state, version: loaded.version, session }), request);
    const logged = await store.apply(owner.tenantId, { type: "journal/view", actor: "owner" }, { actor: "owner", source: "button" });
    if (logged.ok) return withRenewedSession(ownerOk({ state: logged.state, version: logged.version, session }), request);
    // Only a load logged a moment ago is refused without a detail. Any other refusal (a busy salon, a full document) means this load is not on the log, so it is not served.
    if (logged.reason === "rejected" && !logged.detail) return withRenewedSession(ownerOk({ state: loaded.state, version: loaded.version, session }), request);
    return ownerError("unavailable", 503);
  }, { write: false });
}
