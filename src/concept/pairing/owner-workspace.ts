// The owner surface supplies tenant identity and transaction lifetime. The adapter
// has no authority to authenticate a caller or choose a different tenant.
import type { PairWorkspace } from "@prisma/client";
import { salonClock } from "../tools/clock";
import { bookingById, bookingView, itemView, options, proposalView, type Move } from "./appointments";
import type { Tx } from "./db";
import { requirePair } from "./http";
import { decide, propose } from "./proposals";
import { snapshot } from "./fixture";

type Booking = ReturnType<typeof bookingView>;
type Proposal = ReturnType<typeof proposalView>;

export interface OwnerWorkspace {
  brief(): { salon: string; today: string; timezone: string; bookingsToday: number; nextBooking: Booking | null };
  bookings(date?: string, query?: string): { bookings: Booking[]; total: number };
  booking(id: string): Booking;
  inbox(): { items: ReturnType<typeof itemView>[] };
  thread(id: string): ReturnType<typeof itemView>;
  slots(bookingId: string, date?: string): { bookingId: string; slots: ReturnType<typeof options> };
  propose(clientId: string, key: string, move: Move): Promise<Proposal>;
  proposal(id: string): Promise<Proposal>;
  decide(id: string, approve: boolean): Promise<Proposal>;
}

export function snapshotWorkspace(tx: Tx, w: PairWorkspace): OwnerWorkspace {
  const state = snapshot(w);
  return {
    brief() {
      const { today, minutes } = salonClock();
      const bookings = state.bookings.filter(b => b.date === today && b.status === "booked");
      const next = bookings.filter(b => b.start >= minutes).sort((a, b) => a.start - b.start)[0];
      return { salon: state.salon.name, today, timezone: "Europe/Stockholm", bookingsToday: bookings.length,
        nextBooking: next ? bookingView(state, next) : null };
    },
    bookings(date, query) {
      const today = salonClock().today;
      const bookings = state.bookings.filter(b => b.status === "booked" && (date ? b.date === date : b.date >= today))
        .map(b => bookingView(state, b)).filter(b => !query || b.untrustedCustomerText.customer.toLowerCase().includes(query.toLowerCase()));
      return { bookings: bookings.slice(0, 30), total: bookings.length };
    },
    booking: id => bookingView(state, bookingById(state, id)),
    inbox: () => ({ items: state.inbox.slice(0, 25).map(i => itemView(i)) }),
    thread(id) {
      const item = state.inbox.find(i => i.id === id);
      requirePair(item, "item_not_found", 404);
      return itemView(item, true);
    },
    slots: (id, date) => ({ bookingId: id, slots: options(state, bookingById(state, id), date) }),
    propose: (clientId, key, move) => propose(tx, w.id, state, clientId, key, move),
    async proposal(id) {
      const row = await tx.pairProposal.findFirst({ where: { workspaceId: w.id, id } });
      requirePair(row, "proposal_not_found", 404);
      return proposalView(row);
    },
    decide: (id, approve) => decide(tx, w.id, state, id, approve),
  };
}
