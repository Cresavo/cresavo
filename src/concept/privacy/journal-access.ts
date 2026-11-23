import type { StaffId } from "../data/types";
import type { DemoState, JournalAccess } from "../data/types";
import { monthsBefore, RETENTION } from "./retention";

// The log of journal reads (GDPR art. 5(1)(f), 32; docs/legal/DPIA_JOURNAL.md).
// It records who and when, and which customer's journal; never any content.
//
// Where reads are logged today:
// - The studio reports a read when a journal is opened (`journal/view` with a
//   customer). For an account salon this is a request to the server, which
//   stamps the time; the actor is what the studio says it is.
// - The server logs a load of the salon (`GET /api/owner/salon`), which hands
//   the whole document, every journal included, to the browser (`journal/view`
//   without a customer).
// - With server-side journals (JOURNALS_ON_SERVER) the load carries no text and
//   is not logged; `GET /api/owner/journals` hands out one customer's journal
//   and logs that read on the server in the same transaction.
// While that flag is off, the browser holds every journal after the load, so a
// modified client can read without reporting.

/** The same reader opening the same journal again within this time is one read. */
export const SAME_READ_WINDOW_MS = 60_000;
/** A load that delivered every journal is logged at most this often per salon. */
export const LOAD_WINDOW_MS = 10 * 60_000;
/** The most reads kept; the oldest go first. */
export const JOURNAL_ACCESS_CAP = 5000;

export interface JournalViewAction {
  customerId?: string;
  actor: JournalAccess["actor"];
  staffId?: StaffId;
  /** Set only by the server's journal route (never accepted from a client): it handed the text out. */
  served?: true;
}

/** Adds one read to the log, or returns the same state when it is invalid or repeats a read just made. Reads older than the log's retention fall off. */
export function recordJournalView(state: DemoState, action: JournalViewAction, now: number): DemoState {
  if (action.actor !== "owner" && action.actor !== "staff") return state;
  if (action.customerId !== undefined && !state.customers.some((c) => c.id === action.customerId)) return state;
  if (action.staffId !== undefined && (action.actor !== "staff" || !state.staff.some((s) => s.id === action.staffId))) return state;
  const log = state.journalAccess ?? [];
  const window = action.customerId === undefined ? LOAD_WINDOW_MS : SAME_READ_WINDOW_MS;
  // A read the server handed out is only ever the repeat of another such read, never of one the studio reported.
  const repeated = log.some((entry) => now - entry.at < window && entry.actor === action.actor && entry.staffId === action.staffId &&
    entry.customerId === action.customerId && !!entry.served === !!action.served);
  if (repeated) return state;
  const entry: JournalAccess = {
    id: `ja-${state.seq}`, at: now, actor: action.actor,
    ...(action.staffId ? { staffId: action.staffId } : {}),
    ...(action.customerId ? { customerId: action.customerId } : {}),
    ...(action.served === true ? { served: true as const } : {}),
  };
  const cutoff = monthsBefore(now, RETENTION.journalAccessLogMonths);
  const journalAccess = [entry, ...log.filter((old) => old.at >= cutoff)].slice(0, JOURNAL_ACCESS_CAP);
  return { ...state, seq: state.seq + 1, journalAccess };
}
