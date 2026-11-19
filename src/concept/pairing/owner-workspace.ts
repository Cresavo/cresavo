// The owner surface supplies tenant identity and transaction lifetime. The adapter
// has no authority to authenticate a caller or choose a different tenant.
import type { PairWorkspace } from "@prisma/client";
import { snapshotReads, page, type Page } from "./reads";
import { proposalScope, type ProposalInput } from "./changes";
import type { ChangeDraft } from "../tools/define";
import { salonClock } from "../tools/clock";
import { bookingById, bookingView, itemView, options, proposalView } from "./appointments";
import type { Tx } from "./db";
import { requirePair } from "./http";
import { decide, propose } from "./proposals";
import { snapshot } from "./fixture";

type Booking = ReturnType<typeof bookingView>;
type Proposal = ReturnType<typeof proposalView>;

export interface OwnerWorkspace extends ReturnType<typeof snapshotReads> {
  brief(): { salon: string; today: string; timezone: string; bookingsToday: number; nextBooking: Booking | null };
  bookings(date?: string, query?: string, paging?: Page): { bookings: Booking[]; total: number; nextOffset: number | null };
  booking(id: string): Booking;
  inbox(paging?: Page): { nextOffset: number | null; items: ReturnType<typeof itemView>[] };
  thread(id: string): ReturnType<typeof itemView>;
  slots(bookingId: string, date?: string, paging?: Page): { nextOffset: number | null; bookingId: string; slots: ReturnType<typeof options> };
  propose(clientId: string, key: string, input: ProposalInput): Promise<Proposal>;
  proposal(id: string, scopes: string[]): Promise<Proposal>;
  decide(id: string, approve: boolean): Promise<Proposal>;
}

export function snapshotWorkspace(tx: Tx, w: PairWorkspace): OwnerWorkspace {
  const state = snapshot(w);
  return {
    ...snapshotReads(state),
    brief() {
      const { today, minutes } = salonClock();
      const bookings = state.bookings.filter(b => b.date === today && b.status === "booked");
      const next = bookings.filter(b => b.start >= minutes).sort((a, b) => a.start - b.start)[0];
      return { salon: state.salon.name, today, timezone: "Europe/Stockholm", bookingsToday: bookings.length,
        nextBooking: next ? bookingView(state, next) : null };
    },
    bookings(date, query, paging) {
      const today = salonClock().today;
      const bookings = state.bookings.filter(b => b.status === "booked" && (date ? b.date === date : b.date >= today))
        .map(b => bookingView(state, b)).filter(b => !query || b.untrustedCustomerText.customer.toLowerCase().includes(query.toLowerCase()));
      return page("bookings", bookings, { limit: 30, ...paging });
    },
    booking: id => bookingView(state, bookingById(state, id)),
    inbox: paging => page("items", state.inbox.map(i => itemView(i)), paging),
    thread(id) {
      const item = state.inbox.find(i => i.id === id);
      requirePair(item, "item_not_found", 404);
      return itemView(item, true);
    },
    slots: (id, date, paging) => ({ bookingId: id, ...page("slots", options(state, bookingById(state, id), date), { limit: 12, ...paging }) }),
    propose: (clientId, key, input) => propose(tx, w.id, state, clientId, key, input),
    async proposal(id, scopes) {
      const row = await tx.pairProposal.findFirst({ where: { workspaceId: w.id, id } });
      requirePair(row && scopes.includes(proposalScope((row.draft as unknown as ChangeDraft).action.type)), "proposal_not_found", 404);
      return proposalView(row);
    },
    decide: (id, approve) => decide(tx, w.id, state, id, approve),
  };
}
