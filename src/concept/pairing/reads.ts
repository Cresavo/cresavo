import { dueBackList } from "../customers/return-visits";
import { addDays, diffDays, formatTime, startOfWeek } from "../data/dates";
import { freeStarts, lunchFor, needOf, workWindow } from "../data/slots";
import type { Customer, StaffId } from "../data/types";
import { figuresFor } from "../finance/figures";
import { periodRanges, type PeriodKey } from "../finance/periods";
import { buildCustomerStats, finishedVisit, fullName } from "../selectors";
import { salonClock } from "../tools/clock";
import { bookingView } from "./appointments";
import type { PairState } from "./fixture";
import { requirePair } from "./http";

export interface Page { offset?: number; limit?: number }
export function page<T, K extends string>(key: K, rows: T[], { offset = 0, limit = 25 }: Page = {}) {
  return { ...({ [key]: rows.slice(offset, offset + limit) } as Record<K, T[]>),
    total: rows.length, nextOffset: offset + limit < rows.length ? offset + limit : null };
}

export function serviceById(state: PairState, id: string) {
  const service = state.services.find(s => s.id === id);
  requirePair(service, "service_not_found", 404);
  return service;
}
export function customerById(state: PairState, id: string) {
  const customer = state.customers.find(c => c.id === id);
  requirePair(customer, "customer_not_found", 404);
  return customer;
}
export const staffRef = (state: PairState, staffId: StaffId) => state.staffRefs?.[staffId] ?? staffId;
export function staffByRef(state: PairState, ref: string) {
  const staff = state.staff.find(s => staffRef(state, s.id) === ref);
  requirePair(staff, "staff_not_found", 404);
  return staff;
}
const customerView = (c: Customer) => ({ customerId: c.id, untrustedCustomerText: { name: fullName(c) } });
function dates(from: string, to: string) {
  const days = diffDays(to, from) + 1;
  requirePair(days > 0 && days <= 31, "invalid_date_range");
  return Array.from({ length: days }, (_, i) => addDays(from, i));
}
type Window = { from: string; to: string; staffId?: string } & Page;

export function snapshotReads(state: PairState) {
  return {
    calendar({ from, to, staffId, ...paging }: Window) {
      dates(from, to);
      const staff = staffId && staffByRef(state, staffId).id;
      const includes = (b: { date: string; staffId: StaffId }) => b.date >= from && b.date <= to && (!staff || b.staffId === staff);
      const bookings = state.bookings.filter(b => includes(b) && b.status !== "cancelled")
        .map(b => ({ kind: "booking" as const, ...bookingView(state, b) }));
      const blocks = (state.blocks ?? []).filter(includes).map(b => ({ kind: "block" as const, staffId: staffRef(state, b.staffId),
        date: b.date, time: formatTime(b.start), end: formatTime(b.end), reason: b.reason }));
      return page("entries", [...bookings, ...blocks].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)), paging);
    },
    bookable({ serviceId, from, to, staffId, ...paging }: Window & { serviceId: string }) {
      const clock = salonClock();
      requirePair(from >= clock.today && to <= addDays(clock.today, 90), "choose_upcoming_date");
      const service = serviceById(state, serviceId);
      const staff = staffId && staffByRef(state, staffId).id;
      const eligible = service.staffIds.filter(s => !staff || staff === s);
      const slots = dates(from, to).flatMap(date => service.hidden ? [] : eligible.flatMap(id =>
        freeStarts(state, id, date, needOf(service), { after: date === clock.today ? clock.minutes : 0 })
          .map(start => ({ date, time: formatTime(start), staffId: staffRef(state, id) }))));
      return page("slots", slots, paging);
    },
    customers(query: string, paging: Page) {
      return page("customers", state.customers.filter(c => fullName(c).toLowerCase().includes(query.toLowerCase())).map(customerView), paging);
    },
    history(id: string, paging: Page) {
      customerById(state, id);
      const { today, minutes } = salonClock();
      const visits = state.bookings.filter(b => b.customerId === id && finishedVisit(b, today, minutes))
        .sort((a, b) => b.date.localeCompare(a.date) || b.start - a.start);
      return page("visits", visits.map(b => bookingView(state, b)), paging);
    },
    dueBack(paging: Page) {
      const { today, minutes } = salonClock();
      const due = dueBackList(state, buildCustomerStats(state, today, minutes), today).filter(row => !row.sent);
      return page("customers", due.map(row => ({ ...customerView(row.customer), serviceId: row.service.id,
        lastVisit: row.lastVisit, dueDate: row.dueDate })), paging);
    },
    treatments(paging: Page) {
      return page("treatments", state.services.map(s => ({ serviceId: s.id, untrustedCustomerText: { name: s.name },
        duration: s.duration, priceMinor: Math.round(s.price * 100), currency: "SEK", visible: !s.hidden, staffIds: s.staffIds.map(id => staffRef(state, id)) })), paging);
    },
    staff(paging: Page) {
      return page("staff", state.staff.map(s => ({ staffId: staffRef(state, s.id), name: s.firstName, title: s.title })), paging);
    },
    schedule(ref: string, week: string, paging: Page) {
      const { id } = staffByRef(state, ref);
      const first = startOfWeek(week);
      const days = dates(first, addDays(first, 6)).map(date => {
        const hours = workWindow(state, id, date);
        const lunch = lunchFor(state.salon, date);
        const span = (v: { start: number; end: number }) => ({ from: formatTime(v.start), to: formatTime(v.end) });
        return { date, hours: hours && span(hours), lunch: hours && lunch && span(lunch),
          blocks: (state.blocks ?? []).filter(b => b.staffId === id && b.date === date).map(b => ({ ...span(b), reason: b.reason })) };
      });
      return page("days", days, paging);
    },
    finance(period: PeriodKey) {
      const clock = salonClock();
      const { current } = periodRanges(period, clock);
      const { revenue, ...figures } = figuresFor(state, current, clock);
      return { period, from: current.start, to: addDays(current.end, -1), currency: "SEK", revenueMinor: Math.round(revenue * 100), ...figures };
    },
  };
}
