import { preferredStaffOf } from "../assistant/memory";
import { addDays, diffDays } from "../data/dates";
import { freeStarts, needOf } from "../data/slots";
import type { Booking, Customer, DateKey, DemoState, Service, SlotSuggestion } from "../data/types";
import { findService, type CustomerStats } from "../selectors";
import { NOT_SEEN_DAYS } from "./segments";
import { suggestedWeeks } from "./next-visit";

// Return-visit engine: each service has a recommended interval in weeks. A
// customer is "due back" when that interval has passed since their last visit
// and nothing is booked. Customers gone for over three months are a separate
// segment (not seen in 3 months), so they are not listed here.

export const MIN_INTERVAL_WEEKS = 1;
export const MAX_INTERVAL_WEEKS = 26;
const SEARCH_DAYS = 21;
const DEFAULT_START = 14 * 60;

/** Weeks until this customer should be back: the latest journal note if it names one, else the service's interval. */
export function intervalWeeks(state: DemoState, customer: Customer, service: Service, lastVisit: DateKey): number {
  const note = state.journals
    .filter((j) => j.customerId === customer.id && j.date >= lastVisit && j.nextVisit)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  return (note?.nextVisit && suggestedWeeks(note.nextVisit)) || service.recallWeeks;
}

export interface NextVisit {
  service: Service;
  /** Booked time, if there is one. */
  booking?: Booking;
  /** Date the interval ends; for a booked visit, the booking date. */
  date: DateKey;
  weeks: number;
}

/** What comes next for a customer: their booking, or the date they are due back. Undefined with no visit history. */
export function nextVisitFor(state: DemoState, customer: Customer, stats: Map<string, CustomerStats>): NextVisit | undefined {
  const s = stats.get(customer.id);
  if (s?.nextBooking) {
    const service = findService(state, s.nextBooking.serviceId);
    return service && { service, booking: s.nextBooking, date: s.nextBooking.date, weeks: intervalWeeks(state, customer, service, s.nextBooking.date) };
  }
  const service = s?.lastServiceId ? findService(state, s.lastServiceId) : undefined;
  if (!s?.lastVisit || !service) return undefined;
  const weeks = intervalWeeks(state, customer, service, s.lastVisit);
  return { service, date: addDays(s.lastVisit, weeks * 7), weeks };
}

export interface DueBack {
  customer: Customer;
  service: Service;
  lastVisit: DateKey;
  dueDate: DateKey;
  /** Days past the due date. */
  overdueDays: number;
  /** A time suggestion was already sent after the last visit. */
  sent: boolean;
}

/** Whether a simulated time suggestion went out to the customer after `since`. */
export function suggestionSent(state: DemoState, customerId: string, since: DateKey): boolean {
  return state.inbox.some((i) => i.recallServiceId && i.customerId === customerId && i.date >= since);
}

/** Customers past their return interval with nothing booked, most overdue first. */
export function dueBackList(state: DemoState, stats: Map<string, CustomerStats>, today: DateKey): DueBack[] {
  const list: DueBack[] = [];
  for (const customer of state.customers) {
    const next = nextVisitFor(state, customer, stats);
    const lastVisit = stats.get(customer.id)?.lastVisit;
    if (!next || next.booking || !lastVisit || diffDays(today, lastVisit) > NOT_SEEN_DAYS) continue;
    const overdueDays = diffDays(today, next.date);
    if (overdueDays < 0) continue;
    list.push({ customer, service: next.service, lastVisit, dueDate: next.date, overdueDays, sent: suggestionSent(state, customer.id, lastVisit) });
  }
  return list.sort((a, b) => b.overdueDays - a.overdueDays || a.customer.firstName.localeCompare(b.customer.firstName, "sv"));
}

/** The start minute this customer usually books: the median of their finished visits. */
function usualStart(state: DemoState, customerId: string): number {
  const starts = state.bookings.filter((b) => b.customerId === customerId && b.status === "completed").map((b) => b.start).sort((a, b) => a - b);
  return starts.length ? starts[Math.floor(starts.length / 2)] : DEFAULT_START;
}

/** The first free time from tomorrow, with the customer's preferred person, nearest to when they usually come. */
export function suggestSlot(state: DemoState, customer: Customer, service: Service, today: DateKey): SlotSuggestion | undefined {
  const preferred = preferredStaffOf(state, customer);
  const staffId = service.staffIds.includes(preferred) ? preferred : service.staffIds[0];
  const usual = usualStart(state, customer.id);
  for (let i = 1; i <= SEARCH_DAYS; i++) {
    const date = addDays(today, i);
    const starts = freeStarts(state, staffId, date, needOf(service));
    if (starts.length) {
      const start = starts.reduce((best, s) => (Math.abs(s - usual) < Math.abs(best - usual) ? s : best));
      return { staffId, serviceId: service.id, date, start };
    }
  }
  return undefined;
}

/** Booking page link prefilled with the treatment. */
export function bookingLink(state: DemoState, serviceId: string): string {
  return `/boka/${state.salon.slug}?service=${serviceId}`;
}
