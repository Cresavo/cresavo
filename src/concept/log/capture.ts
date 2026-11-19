import { reduce, type DemoAction } from "../actions";
import type { DemoState } from "../data/types";
import { describeAction, isLogged } from "./describe";
import { diffStates } from "./patch";
import type { LogEntry, LogMeta } from "./types";

/** Newest entries kept; older ones fall off so the browser storage stays small. */
export const LOG_LIMIT = 100;

/** Changes that cannot be taken back: access grants and tickets are records, not edits. */
const NOT_UNDOABLE = new Set<DemoAction["type"]>(["support/grant", "support/revoke", "ticket/create", "online/hold", "online/pay", "online/release", "booking/fee"]);

/** Who and where, when the caller does not say: customers act through the booking page, everything else is the owner's button. */
export function defaultMeta(action: DemoAction, at: number): LogMeta {
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
  if ((action.type === "salon/policy" || action.type === "booking/fee") && meta.actor !== "owner") return state;
  const next = reduce(state, action, meta.at);
  if (next === state || !isLogged(action)) return next;
  const patch = diffStates(state, next);
  if (!patch) return next;
  const { summary, before, after } = describeAction(action, state, next);
  const entry: LogEntry = {
    ...meta,
    id: `l-${next.seq}`,
    type: action.type,
    summary,
    before,
    after,
    patch: NOT_UNDOABLE.has(action.type) || (action.type === "booking/cancel" && next.bookings.find(b => b.id === action.id)?.protection?.refund) ? undefined : patch,
  };
  return { ...next, seq: next.seq + 1, log: [entry, ...next.log].slice(0, LOG_LIMIT) };
}
