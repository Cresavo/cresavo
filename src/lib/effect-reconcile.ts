import type { PrismaClient } from "@prisma/client";
import { parseMessageReference } from "../concept/booking/messages";
import type { DeliveryState, OutboxEntry } from "../concept/connections/simulated/outbox";
import type { ListedEffect, ReconcileAction } from "./effect-reconcile-cli";
import { maskAddress } from "./effect-reconcile-cli";
import { messageAddress } from "./message-sink";

// What `npm run effects:reconcile` does to the e-mail outbox (`tenant_effect`,
// docs/operations/INCIDENT_RUNBOOK.md#reconciling-the-e-mail-outbox). An
// operator reopens or settles a row by hand; the deliverer's rules stay as
// they are (src/lib/message-sink.ts):
//
// - `retry` puts a `failed` e-mail back to pending with its attempts reset,
//   keeping what the first attempt froze (message, link, sender, reply-to) so
//   the resend is the same under the same idempotency key. A row that may have
//   left (`dispatched`) is reopened only with `--force-maybe-duplicate`, which
//   also drops the marker: the operator has accepted a possible second copy.
// - `mark-sent` and `mark-failed` settle an `uncertain` row after a look at the
//   provider's log. `mark-failed` keeps the marker, so a retry of it still
//   needs the force flag.
// - Each id is decided and changed in its own transaction under the row's lock,
//   only for the tenant the operator named; running it again changes nothing.
//
// Nothing personal is printed or returned: no body, no address but its domain.
// The tenant's audit log (`tenant_action`) records the studio's own changes,
// one per document version, so these actions are a structured log line instead.

/** Longest wait for a row a deliverer is writing: its writes take milliseconds. */
const LOCK_TIMEOUT = "3000ms";

/** What the decision needs of a locked row. */
export interface EffectRow {
  id: string;
  tenant_id: string;
  kind: string;
  status: string;
  /** Erased by a customer erasure: never reopened. */
  erased: boolean;
  /** A deliverer's claim that has not run out: it may still be sending. */
  leased: boolean;
  payload: OutboxEntry;
}

export type Decision =
  | { outcome: "change"; status: "pending" | "delivered" | "failed"; delivery: DeliveryState; resetAttempts: boolean }
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
  const uncertain = row.status === "failed" && delivery.reason === "uncertain";

  if (action === "retry") {
    if (row.status === "pending") return unchanged("pending");
    if (row.status === "delivered") return unchanged("delivered");
    if (row.leased) return refused("leased");
    if (delivery.sent) return refused("already_sent");
    if (delivery.dispatched && !forceMaybeDuplicate) return refused("dispatched");
    // The reason would fail it again at once; the frozen message, link, sender and reply-to stay for the resend.
    const cleared = without(delivery, forceMaybeDuplicate ? ["reason", "lastError", "dispatched", "provider", "account"] : ["reason", "lastError"]);
    return { outcome: "change", status: "pending", delivery: { ...cleared, reconciled: "retried" }, resetAttempts: true };
  }
  if (action === "mark-sent") {
    if (row.status === "delivered") return unchanged("delivered");
    if (!uncertain) return refused(row.status === "failed" ? "not_uncertain" : row.status);
    if (row.leased) return refused("leased");
    const settled = without(delivery, ["reason", "lastError", "dispatched", "provider", "account", "mail", "link", "from", "replyTo"]);
    return { outcome: "change", status: "delivered", delivery: { ...settled, sent: true, reconciled: "sent" }, resetAttempts: false };
  }
  if (row.status === "failed" && delivery.reconciled === "not_sent") return unchanged("not_sent");
  if (!uncertain) return refused(row.status === "failed" ? "not_uncertain" : row.status);
  if (row.leased) return refused("leased");
  // The marker stays: a request did leave once, so a later retry still has to be forced.
  return { outcome: "change", status: "failed", delivery: { ...without(delivery, ["lastError"]), reason: "not_sent", reconciled: "not_sent" }, resetAttempts: false };
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
    const [row] = await tx.$queryRaw<EffectRow[]>`
      SELECT id, tenant_id, kind, status, erased_at IS NOT NULL AS erased,
             coalesce(leased_until > clock_timestamp(), false) AS leased, payload
      FROM tenant_effect WHERE id = ${effectId} FOR UPDATE`;
    const decided = decide(action, row, options.tenantId, options.forceMaybeDuplicate);
    if (decided.outcome !== "change" || !options.apply) return decided;
    const reset = decided.resetAttempts;
    await tx.$executeRaw`
      UPDATE tenant_effect SET status = ${decided.status},
        payload = jsonb_set(payload, '{delivery}', ${JSON.stringify(decided.delivery)}::jsonb),
        attempts = CASE WHEN ${reset}::boolean THEN 0 ELSE attempts END,
        next_attempt_at = CASE WHEN ${reset}::boolean THEN least(next_attempt_at, clock_timestamp()) ELSE next_attempt_at END,
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
      state: delivery.reason === "uncertain" ? "uncertain" : "failed",
      ...(row.age_ms === null ? {} : { ageMs: row.age_ms }),
      attempts: row.attempts,
      ...(delivery.reason ?? delivery.lastError ? { error: delivery.reason ?? delivery.lastError } : {}),
      dispatched: delivery.dispatched === true,
      ...(delivery.reconciled ? { reconciled: delivery.reconciled } : {}),
      recipient: email ? maskAddress(messageAddress(docs.get(row.tenant_id), row.payload.reference)) : "-",
    };
  });
}
