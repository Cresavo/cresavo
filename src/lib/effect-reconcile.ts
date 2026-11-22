import type { PrismaClient } from "@prisma/client";
import { parseMessageReference } from "../concept/booking/messages";
import { ERROR_CODES } from "../concept/connections/core";
import type { DeliveryState, OutboxEntry } from "../concept/connections/simulated/outbox";
import { EFFECT_ERROR_CODES } from "../concept/store/effect-outbox";
import type { ListedEffect, ReconcileAction } from "./effect-reconcile-cli";
import { maskAddress } from "./effect-reconcile-cli";
import { messageAddress, messageDeliverable } from "./message-sink";

// What `npm run effects:reconcile` does to the e-mail outbox (`tenant_effect`,
// docs/operations/INCIDENT_RUNBOOK.md#reconciling-the-e-mail-outbox). An
// operator reopens or settles a row by hand; the deliverer's rules stay as
// they are (src/lib/message-sink.ts):
//
// - `retry` puts a `failed` e-mail back to pending with a fresh attempt budget,
//   keeping what the first attempt froze (message, link, sender, reply-to) so
//   the resend is the same under the same idempotency key. `attempts` is never
//   lowered (it is also each claim's identity, so a stale deliverer can never
//   write over a newer claim): the budget starts again from `attemptBase`. A
//   send that may have left (`dispatched`, or uncertain) is reopened only with
//   `--force-maybe-duplicate`, which also drops the marker: the operator has
//   accepted a possible second copy. A booking that is gone, cancelled (unless
//   the e-mail is the cancellation) or whose customer was erased is refused, as
//   is a snapshot whose message retention has purged.
// - `mark-sent` and `mark-failed` settle an `uncertain` row after a look at the
//   provider's log. `mark-failed` keeps the marker, so a retry of it still
//   needs the force flag.
// - Each id is decided and changed in its own transaction: a retry first takes
//   the tenant's lock (shared, as a deliverer does; an erasure takes it
//   exclusively), then the row's, and the row is only ever looked up within the
//   tenant the operator named. Running it again changes nothing.
//
// Nothing personal is printed or returned: no body, no address but its domain.
// The tenant's audit log (`tenant_action`) records the studio's own changes,
// one per document version, so these actions are a structured log line instead.

/** Longest wait for a row a deliverer is writing: its writes take milliseconds. */
const LOCK_TIMEOUT = "3000ms";
/**
 * Error codes of a terminal attempt whose request may have reached the provider. A sink timeout is not one: a
 * request in flight keeps the `dispatched` marker, and one that never started has it released.
 */
const MAYBE_SENT_ERRORS = new Set(["EMAIL_UNCERTAIN"]);
/** The reasons the sink and this tool write, and the provider codes it maps: the only ones shown. */
const REASONS = new Set<string>([...ERROR_CODES, "uncertain", "reconcile", "not_sent", "snapshot_purged", "snapshot_missing"]);

/**
 * A failed e-mail that may have been sent: marked so by the sink, or out of attempts with a request that may have
 * left (a `dispatched` marker, or a last error that says so). Settled by a person, never resent unforced.
 */
export function isUncertain(status: string, delivery: DeliveryState): boolean {
  if (status !== "failed") return false;
  if (delivery.reason) return delivery.reason === "uncertain";
  return delivery.dispatched === true || MAYBE_SENT_ERRORS.has(delivery.lastError ?? "");
}

/**
 * What `mark-sent` and `mark-failed` may settle: an uncertain row, or one the provider refused because the key was
 * reused with another body (`reconcile`) after a request that may have left.
 */
const settleable = (status: string, delivery: DeliveryState) =>
  isUncertain(status, delivery) || (status === "failed" && delivery.reason === "reconcile" && delivery.dispatched === true);

/** What a list may show as a row's error: an allowlisted reason or code, else `other`. */
export function shownError(delivery: DeliveryState): string | undefined {
  if (delivery.reason) return REASONS.has(delivery.reason) ? delivery.reason : "other";
  if (delivery.lastError) return EFFECT_ERROR_CODES.has(delivery.lastError) ? delivery.lastError : "other";
  return undefined;
}

/** What the decision needs of a locked row. */
export interface EffectRow {
  id: string;
  tenant_id: string;
  kind: string;
  status: string;
  attempts: number;
  /** Whether the booking still has someone to send to (see `messageDeliverable`); read under the tenant's lock. */
  deliverable: boolean;
  /** Erased by a customer erasure: never reopened. */
  erased: boolean;
  /** A deliverer's claim that has not run out: it may still be sending. */
  leased: boolean;
  payload: OutboxEntry;
}

export type Decision =
  | { outcome: "change"; status: "pending" | "delivered" | "failed"; delivery: DeliveryState; reopen: boolean }
  | { outcome: "unchanged" | "refused"; reason: string };

const without = (delivery: DeliveryState, keys: readonly (keyof DeliveryState)[]): DeliveryState =>
  Object.fromEntries(Object.entries(delivery).filter(([key]) => !keys.includes(key as keyof DeliveryState))) as DeliveryState;

const refused = (reason: string): Decision => ({ outcome: "refused", reason });
const unchanged = (reason: string): Decision => ({ outcome: "unchanged", reason });

/** What `action` would do to `row` for an operator acting on `tenantId`. Pure: the caller holds the lock and writes. */
export function decide(action: ReconcileAction, row: EffectRow | undefined, tenantId: string, forceMaybeDuplicate = false): Decision {
  if (!row) return refused("not_found");
  if (row.tenant_id !== tenantId) return refused("tenant_mismatch");
  if (row.kind !== "message" || row.payload?.port !== "email") return refused("not_email");
  if (row.erased) return refused("erased");
  if (row.status === "cancelled") return refused("cancelled");
  const delivery: DeliveryState = row.payload.delivery ?? {};
  const uncertain = isUncertain(row.status, delivery);

  if (action === "retry") {
    if (row.status === "pending") return unchanged("pending");
    if (row.status === "delivered") return unchanged("delivered");
    if (row.leased) return refused("leased");
    if (delivery.sent) return refused("already_sent");
    if ((delivery.dispatched || uncertain || delivery.reason === "not_sent") && !forceMaybeDuplicate) return refused(delivery.dispatched ? "dispatched" : "uncertain");
    // Retention blanked the message but kept its sender: it cannot be resent as it was.
    if (delivery.reason === "snapshot_purged" || (!delivery.mail && (delivery.from || delivery.link || delivery.replyTo))) return refused("snapshot_purged");
    // Rendered once (an older row, or one whose snapshot was dropped when it settled) but not kept: a retry would send new content.
    if (!delivery.mail && (delivery.firstAttemptAt !== undefined || delivery.submittedAt !== undefined)) return refused("snapshot_missing");
    if (!row.deliverable) return refused("booking_gone");
    // The reason would fail it again at once; the frozen message, link, sender and reply-to stay for the resend.
    const cleared = without(delivery, forceMaybeDuplicate ? ["reason", "lastError", "dispatched", "provider", "account"] : ["reason", "lastError"]);
    return { outcome: "change", status: "pending", delivery: { ...cleared, attemptBase: row.attempts, reconciled: "retried" }, reopen: true };
  }
  if (action === "mark-sent") {
    if (row.status === "delivered") return unchanged("delivered");
    if (!settleable(row.status, delivery)) return refused(row.status === "failed" ? "not_uncertain" : row.status);
    if (row.leased) return refused("leased");
    const settled = without(delivery, ["reason", "lastError", "dispatched", "provider", "account", "mail", "link", "from", "replyTo"]);
    return { outcome: "change", status: "delivered", delivery: { ...settled, sent: true, reconciled: "sent" }, reopen: false };
  }
  if (row.status === "failed" && delivery.reconciled === "not_sent") return unchanged("not_sent");
  if (!settleable(row.status, delivery)) return refused(row.status === "failed" ? "not_uncertain" : row.status);
  if (row.leased) return refused("leased");
  // The marker stays: a request did leave once, so a later retry still has to be forced.
  return { outcome: "change", status: "failed", delivery: { ...without(delivery, ["lastError"]), reason: "not_sent", reconciled: "not_sent" }, reopen: false };
}

export interface ReconcileResult {
  effectId: string;
  outcome: Decision["outcome"];
  reason?: string;
}

/** Decides and, with `apply`, changes one row in its own transaction under its lock. */
export async function reconcileEffect(
  prisma: PrismaClient,
  action: ReconcileAction,
  effectId: string,
  options: { tenantId: string; apply: boolean; forceMaybeDuplicate?: boolean },
): Promise<ReconcileResult> {
  const decision = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('lock_timeout', ${LOCK_TIMEOUT}, true)`;
    // The tenant first, in the order a deliverer takes them: the booking is judged after any erasure that finished.
    const [state] = action === "retry"
      ? await tx.$queryRaw<Array<{ doc: unknown }>>`SELECT doc FROM tenant_state WHERE tenant_id = ${options.tenantId} FOR SHARE`
      : [];
    const [found] = await tx.$queryRaw<Array<Omit<EffectRow, "deliverable">>>`
      SELECT id, tenant_id, kind, status, attempts, erased_at IS NOT NULL AS erased,
             coalesce(leased_until > clock_timestamp(), false) AS leased, payload
      FROM tenant_effect WHERE id = ${effectId} AND tenant_id = ${options.tenantId} FOR UPDATE`;
    const row = found && { ...found, deliverable: !!state && messageDeliverable(state.doc, found.payload?.reference) };
    const decided = decide(action, row, options.tenantId, options.forceMaybeDuplicate);
    if (decided.outcome !== "change" || !options.apply) return decided;
    const reopen = decided.reopen;
    await tx.$executeRaw`
      UPDATE tenant_effect SET status = ${decided.status},
        payload = jsonb_set(payload, '{delivery}', ${JSON.stringify(decided.delivery)}::jsonb),
        next_attempt_at = CASE WHEN ${reopen}::boolean THEN least(next_attempt_at, clock_timestamp()) ELSE next_attempt_at END,
        leased_until = NULL,
        delivered_at = CASE WHEN ${decided.status} = 'delivered' THEN clock_timestamp() END
      WHERE id = ${effectId} AND tenant_id = ${options.tenantId}`;
    return decided;
  });
  return { effectId, outcome: decision.outcome, ...("reason" in decision ? { reason: decision.reason } : {}) };
}

interface FailedRow {
  id: string;
  tenant_id: string;
  kind: string;
  attempts: number;
  payload: OutboxEntry;
  age_ms: number | null;
}

/** Failed and uncertain effects, per tenant in commit order, shown without content. */
export async function listUnsettled(prisma: PrismaClient, options: { tenantId?: string; limit: number }): Promise<ListedEffect[]> {
  const tenant = options.tenantId ?? null;
  const rows = await prisma.$queryRaw<FailedRow[]>`
    SELECT e.id, e.tenant_id, e.kind, e.attempts, e.payload,
      (extract(epoch FROM clock_timestamp()) * 1000 - coalesce(extract(epoch FROM a.at) * 1000, (e.payload #>> '{delivery,firstAttemptAt}')::float8))::float8 AS age_ms
    FROM tenant_effect e
    LEFT JOIN tenant_action a ON a.tenant_id = e.tenant_id AND a.seq = e.seq
    WHERE e.status = 'failed' AND (${tenant}::text IS NULL OR e.tenant_id = ${tenant})
    ORDER BY e.tenant_id, e.seq, e.n
    LIMIT ${options.limit}`;
  const tenants = [...new Set(rows.filter((row) => row.payload?.port === "email").map((row) => row.tenant_id))];
  const docs = new Map<string, unknown>();
  if (tenants.length) {
    const states = await prisma.$queryRaw<Array<{ tenant_id: string; doc: unknown }>>`
      SELECT tenant_id, doc FROM tenant_state WHERE tenant_id = ANY(${tenants}::text[])`;
    for (const state of states) docs.set(state.tenant_id, state.doc);
  }
  return rows.map((row) => {
    const delivery: DeliveryState = row.payload?.delivery ?? {};
    const email = row.payload?.port === "email";
    const message = row.payload?.reference ? parseMessageReference(row.payload.reference) : undefined;
    return {
      id: row.id,
      tenantId: row.tenant_id,
      kind: `${row.payload?.port ?? row.kind}/${message?.kind ?? row.payload?.action ?? "-"}`,
      state: isUncertain("failed", delivery) ? "uncertain" : "failed",
      ...(row.age_ms === null ? {} : { ageMs: row.age_ms }),
      attempts: row.attempts,
      ...(shownError(delivery) ? { error: shownError(delivery) } : {}),
      dispatched: delivery.dispatched === true,
      ...(delivery.reconciled ? { reconciled: delivery.reconciled } : {}),
      recipient: email ? maskAddress(messageAddress(docs.get(row.tenant_id), row.payload.reference)) : "-",
    };
  });
}
