import type { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { JOURNALS_UNAVAILABLE } from "@/concept/store/postgres-studio-store";
import { JournalUnreadable } from "@/concept/store/journal-crypto";
import { idempotencyKeySchema } from "@/lib/validation";
import { ownerError, ownerOk, ownerRoute, readBoundedJson, fullOwner, refusedOwner, sessionKey, sessionOwner, withRenewedSession } from "@/lib/owner-http";
import { UPLOAD_SESSION_HEADER } from "@/lib/media/limits";
import { actionTooLarge } from "@/lib/owner-actions/parse";
import { id } from "@/lib/owner-actions/primitives";
import { MAX_ACTION_BYTES } from "@/lib/owner-actions/types";
import { journalsOnServer, salonForBrowser } from "@/lib/owner-journals";
import { ownerAction, ownerStore } from "@/lib/owner-store";
import { checkRateLimit } from "@/lib/rate-limit";

// Server-side journals (JOURNALS_ON_SERVER): one customer's entries are read here, and entries are added and
// edited here, through the store's action path (audit log, undo, idempotency). The salon always comes from the
// session, never the request. Trashing and restoring follow the customer (`customer/delete`, `trash/restore`,
// `log/undo` on the actions route); the store marks the rows. With the flag off this route does not exist.

const bodySchema = z.object({
  action: z.unknown(),
  expectedVersion: z.number().int().nonnegative().optional(),
  idempotencyKey: idempotencyKeySchema,
}).strict();

const MAX_BODY_BYTES = MAX_ACTION_BYTES + 1024;
const WRITES = new Set(["journal/add", "journal/edit"]);
const STATUS = { conflict: 409, rejected: 422, "idempotency-mismatch": 409, "not-found": 404 } as const;

const unavailable = () => ownerError(JOURNALS_UNAVAILABLE, 503);

/** Runs a journal handler for a signed-in owner with a full session, while the flag is on. */
function journalRoute(request: NextRequest, handler: (tenantId: string, session: string) => Promise<NextResponse>, options?: { write?: boolean }) {
  return ownerRoute(request, async () => {
    if (!journalsOnServer()) return ownerError("not_found", 404);
    const owner = await sessionOwner(request);
    if (!fullOwner(owner)) return refusedOwner(owner);
    // Bound to the session the studio loaded the salon in: a tab still showing another account's salon (or a change
    // queued there) is refused before anything is read or written, as for the photo library.
    if (request.headers.get(UPLOAD_SESSION_HEADER) !== sessionKey(owner)) return ownerError("session_changed", 409);
    try {
      return withRenewedSession(await handler(owner.tenantId, sessionKey(owner)), request);
    } catch (error) {
      // A version that does not decrypt (another key, a changed row): never a partial journal.
      if (error instanceof JournalUnreadable) return ownerError("journals_unreadable", 503);
      throw error;
    }
  }, options);
}

/**
 * `?customer=<id>`: that customer's live entries with their text, every version included. The read is logged as
 * `journal/view` for that customer in the same transaction (shown to the owner under Privacy); the same reader
 * opening it again within a minute counts once.
 */
export function GET(request: NextRequest) {
  return journalRoute(request, async (tenantId) => {
    const customer = id.safeParse(request.nextUrl.searchParams.get("customer"));
    if (!customer.success) return ownerError("invalid", 400);
    await checkRateLimit("journal-read", tenantId);
    const store = ownerStore();
    const read = await store.readJournals(tenantId, customer.data, { actor: "owner", source: "button" });
    if (!read.ok) return read.reason === "unavailable" ? unavailable() : ownerError(read.reason, STATUS[read.reason]);
    return ownerOk({ entries: read.entries, version: read.version });
  }, { write: false });
}

/** Adds an entry (`journal/add`) or a new version of one (`journal/edit`). The text goes to the table, the salon gets a stub. */
export function POST(request: NextRequest) {
  return journalRoute(request, async (tenantId, session) => {
    const json = await readBoundedJson(request, MAX_BODY_BYTES);
    if (json === "too_large") return ownerError("too_large", 413);
    const body = bodySchema.safeParse(json);
    if (body.success && actionTooLarge(body.data.action)) return ownerError("too_large", 413);
    const action = body.success ? ownerAction(body.data.action) : null;
    if (!body.success || !action || !WRITES.has(action.type)) return ownerError("invalid", 400);
    await checkRateLimit("journal-write", tenantId);
    const result = await ownerStore().apply(tenantId, action, { actor: "owner", source: "button" }, {
      expectedVersion: body.data.expectedVersion, idempotencyKey: body.data.idempotencyKey,
    });
    if (!result.ok) return result.detail === JOURNALS_UNAVAILABLE ? unavailable() : ownerError(result.reason, STATUS[result.reason]);
    return ownerOk({ state: salonForBrowser(result.state), version: result.version, replayed: result.replayed, session });
  });
}
