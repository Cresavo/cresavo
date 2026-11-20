import { demoPaymentLedger } from "../connections/demo";
import { reduce, type DemoAction } from "../actions";
import type { DemoState } from "../data/types";
import { t } from "../i18n";
import { formatDayShort, formatTime } from "../i18n/format";
import { describeAction, isLogged } from "./describe";
import { diffStates } from "./patch";
import type { LogEntry, LogMeta } from "./types";

/** Newest entries kept; older ones fall off so the browser storage stays small. */
export const LOG_LIMIT = 100;

/** Changes that cannot be taken back: access grants and tickets are records, not edits; an erasure is final and keeps no copy. */
const NOT_UNDOABLE = new Set<DemoAction["type"]>([
  "support/grant", "support/revoke", "ticket/create", "online/hold", "online/pay", "online/release", "booking/fee", "customer/erase",
  "online/waitlist", "online/claim", "online/decline", "online/leave", "waitlist/offer",
]);

/** Settings and decisions only the owner makes, whatever a caller claims. */
const OWNER_ONLY = new Set<DemoAction["type"]>(["salon/policy", "booking/fee", "waitlist/rules", "waitlist/offer"]);

/** Who and where, when the caller does not say: customers act through the booking page, the salon's clock runs the waiting list, everything else is the owner's button. */
export function defaultMeta(action: DemoAction, at: number): LogMeta {
  if (action.type === "waitlist/advance") return { actor: "automatic", source: "waitlist", at };
  if (action.type.startsWith("online/")) return { actor: "customer", source: "customer-page", at };
  if (action.type === "booking/create" && action.source === "campaign") return { actor: "customer", source: "campaign", at };
  return { actor: "owner", source: "button", at };
}

/**
 * The one way every change enters the demo: the reducer runs, and if it
 * changed anything the log gets an entry with who, what, before/after and
 * what is needed to undo it. Pages never write log entries themselves.
 */
export function applyAction(state: DemoState, action: DemoAction, meta: LogMeta): DemoState {
  const batch = demoPaymentLedger.stage();
  const next = prepareAction(state, action, meta, batch);
  if (next !== state) batch.publish();
  return next;
}

/** One entry per waiting-list transition the change caused: offers sent, held back, ended, and requests that passed. */
function waitlistEvents(prev: DemoState, next: DemoState, action: DemoAction, meta: LogMeta): LogEntry[] {
  const events: LogEntry[] = [];
  // `customerId` lets erasure find and empty the entry: it names the customer by first name.
  const record = (summary: string, actor: LogMeta["actor"], customerId: string | undefined, after?: string) =>
    events.push({ ...meta, id: `wl-${next.seq}-${events.length}`, type: "waitlist/event", actor, source: "waitlist", summary, after, ...(customerId ? { customerId } : {}) });
  const firstName = (id: string) => (next.customers.find((c) => c.id === id) ?? prev.customers.find((c) => c.id === id))?.firstName;
  if (next.waitlistGaps !== prev.waitlistGaps) for (const gap of next.waitlistGaps) {
    if (gap.readyAt && gap.readyAt !== prev.waitlistGaps.find((g) => g.id === gap.id)?.readyAt) {
      record(t("offers.queued"), "automatic", undefined, `${formatDayShort(gap.date)} · ${formatTime(gap.start)}`);
    }
  }
  if (next.waitlistOffers !== prev.waitlistOffers) for (const offer of next.waitlistOffers) {
    if (prev.waitlistOffers.find((o) => o.id === offer.id)?.status === offer.status) continue;
    const actor = offer.status === "offered" ? offer.offeredBy : offer.status === "lapsed" ? "automatic" : "customer";
    record(t(`offers.status.${offer.status}`), actor, offer.customerId, [firstName(offer.customerId), formatDayShort(offer.date), formatTime(offer.start)].filter(Boolean).join(" · "));
  }
  if (next.waitlistEntries !== prev.waitlistEntries && action.type !== "online/leave" && action.type !== "customer/delete" && action.type !== "customer/erase") {
    for (const entry of prev.waitlistEntries) {
      const claimed = next.waitlistOffers.some((o) => o.entryId === entry.id && o.status === "claimed");
      if (entry.days.length && !claimed && !next.waitlistEntries.some((e) => e.id === entry.id)) record(t("offers.entryExpired"), "automatic", entry.customerId, firstName(entry.customerId));
    }
  }
  return events.reverse();
}

export function prepareAction(state: DemoState, action: DemoAction, meta: LogMeta, batch: ReturnType<typeof demoPaymentLedger.stage>): DemoState {
  if ((OWNER_ONLY.has(action.type) || (action.type === "booking/cancel" && action.offerWaitingList)) && meta.actor !== "owner") return state;
  const next = reduce(state, action, meta.at, batch.payments);
  if (next === state) return next;
  const events = action.type === "customer/erase" ? [] : waitlistEvents(state, next, action, meta);
  // The salon's clock, and a click not worth its own entry (reading a message), log only what the waiting list did.
  if (action.type === "waitlist/advance" || !isLogged(action)) return events.length ? { ...next, seq: next.seq + 1, log: [...events, ...next.log].slice(0, LOG_LIMIT) } : next;
  const patch = diffStates(state, next);
  if (!patch) return next;
  // Open times are derived from the calendar: undo restores the calendar and the queue follows it.
  delete patch.collections.waitlistGaps;
  const { summary, before, after } = describeAction(action, state, next);
  // A text that was sent cannot be taken back, so neither can the change that sent it.
  const sentOffer = next.waitlistOffers.length > state.waitlistOffers.length;
  const entry: LogEntry = {
    ...meta,
    id: `l-${next.seq}`,
    type: action.type,
    summary,
    before,
    after,
    patch: NOT_UNDOABLE.has(action.type) || batch.hasPayments() || sentOffer ? undefined : patch,
  };
  return { ...next, seq: next.seq + 1, log: [entry, ...events, ...next.log].slice(0, LOG_LIMIT) };
}
