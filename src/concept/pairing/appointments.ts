import { applyVersioned } from "./versions";
import type { LogMeta } from "../log/types";
import type { PairState } from "./fixture";
import type { PairProposal } from "@prisma/client";
import { addDays, formatTime } from "../data/dates";
import { freeStarts } from "../data/slots";
import type { Booking, DemoState, InboxItem } from "../data/types";
import { fullName } from "../selectors";
import { salonClock } from "../tools/clock";
import type { ChangeDraft } from "../tools/define";
import { proposeMove } from "../tools/write";
import { requirePair } from "./http";

export function bookingById(state: DemoState, id: string) {
  const booking = state.bookings.find(b => b.id === id);
  requirePair(booking, "booking_not_found", 404);
  return booking;
}
export function bookingView(state: PairState, b: Booking) {
  const customer = state.customers.find(c => c.id === b.customerId);
  return { bookingId: b.id, date: b.date, time: formatTime(b.start), staffId: state.staffRefs?.[b.staffId] ?? b.staffId,
    staffName: state.staff.find(s => s.id === b.staffId)?.firstName ?? b.staffId,
    customerId: b.customerId, serviceId: b.serviceId,
    duration: b.duration, status: b.status, untrustedCustomerText: { customer: customer ? fullName(customer) : "",
    service: state.services.find(s => s.id === b.serviceId)?.name ?? b.serviceId } };
}
export function itemView(item: InboxItem, withBody = false) {
  return { itemId: item.id, bookingId: item.bookingId, handled: item.handled, ...(withBody && item.reply ? { untrustedAssistantText: { reply: item.reply } } : {}), date: item.date,
    untrustedCustomerText: { title: item.title, ...(withBody ? { body: item.body } : {}) } };
}
export function options(state: DemoState, booking: Booking, day?: string) {
  const clock = salonClock();
  requirePair(booking.status === "booked", "booking_unavailable", 409);
  const first = day ?? (booking.date > clock.today ? booking.date : clock.today);
  const last = addDays(clock.today, 90);
  requirePair(first >= clock.today && first <= last, "choose_upcoming_date");
  const slots: { date: string; time: string }[] = [];
  for (let offset = 0; offset < (day ? 1 : 7); offset++) {
    const date = addDays(first, offset);
    if (date > last) break;
    const starts = freeStarts(state, booking.staffId, date, booking, {
      ignoreId: booking.id, after: date === clock.today ? clock.minutes : 0,
    });
    for (const start of starts) {
      if (booking.date !== date || booking.start !== start) slots.push({ date, time: formatTime(start) });
    }
  }
  return slots;
}
export type Move = { bookingId: string; date: string; time: string };
export function buildMove(state: DemoState, move: Move) {
  const clock = salonClock();
  requirePair(move.date <= addDays(clock.today, 90), "choose_upcoming_date");
  bookingById(state, move.bookingId);
  const draft = proposeMove.draft({ state, clock }, move);
  requirePair(draft.action.type === "booking/move" && draft.action.date === move.date &&
    formatTime(draft.action.start) === move.time, "choose_another_slot", 409);
  return { ...draft, action: draft.action };
}

export function applyMove(state: PairState, action: ReturnType<typeof buildMove>["action"], meta: LogMeta): PairState {
  return applyVersioned(state, action, meta);
}
export function proposalView(row: PairProposal) {
  const draft = row.draft as unknown as ChangeDraft;
  return { proposalId: row.id, status: row.status,
    // Earlier clients read move rows here. Their only values are approved date/time coordinates.
    ...(draft.action?.type === "booking/move" ? { changes: draft.rows } : {}),
    untrustedCustomerText: { title: draft.title, changes: draft.rows } };
}
