import { addDays, diffDays, monthKey } from "./data/dates";
import { isActive, lunchFor, openingFor, staffWorks } from "./data/slots";
import type { Booking, Customer, DateKey, DemoState, Service, StaffId } from "./data/types";

// Read-only views of the demo state used by several pages.

export const LATE_AFTER_WEEKS = 10;

export function findCustomer(state: DemoState, id: string | undefined): Customer | undefined {
  return id ? state.customers.find((c) => c.id === id) : undefined;
}

export function findService(state: DemoState, id: string): Service | undefined {
  return state.services.find((s) => s.id === id);
}

export function fullName(c: Pick<Customer, "firstName" | "lastName">) {
  return `${c.firstName} ${c.lastName}`;
}

export function dayBookings(state: DemoState, date: DateKey, staffId?: StaffId): Booking[] {
  return state.bookings
    .filter((b) => b.date === date && isActive(b) && (!staffId || b.staffId === staffId))
    .sort((a, b) => a.start - b.start || a.staffId.localeCompare(b.staffId));
}

export interface CustomerStats {
  visits: number;
  spent: number;
  lastVisit?: DateKey;
  lastServiceId?: string;
  nextBooking?: Booking;
}

export function buildCustomerStats(state: DemoState, today: DateKey): Map<string, CustomerStats> {
  const stats = new Map<string, CustomerStats>();
  for (const c of state.customers) stats.set(c.id, { visits: 0, spent: 0 });
  const sorted = [...state.bookings].sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
  for (const b of sorted) {
    const s = stats.get(b.customerId);
    if (!s) continue;
    if (b.status === "completed") {
      s.visits += 1;
      s.spent += b.price;
      s.lastVisit = b.date;
      s.lastServiceId = b.serviceId;
    } else if (b.status === "booked" && b.date >= today && !s.nextBooking) {
      s.nextBooking = b;
    }
  }
  return stats;
}

/** Customers who have been here at least twice but not for a long time, with nothing booked. */
export function lateCustomers(state: DemoState, stats: Map<string, CustomerStats>, today: DateKey): Customer[] {
  return state.customers.filter((c) => {
    const s = stats.get(c.id);
    return !!s?.lastVisit && s.visits >= 2 && !s.nextBooking && diffDays(today, s.lastVisit) > LATE_AFTER_WEEKS * 7;
  });
}

/** Foot care customers past their recommended return interval (but not yet "late"). */
export function recallDue(state: DemoState, stats: Map<string, CustomerStats>, today: DateKey): Customer[] {
  return state.customers.filter((c) => {
    const s = stats.get(c.id);
    if (!s?.lastVisit || s.nextBooking || !s.lastServiceId) return false;
    const service = findService(state, s.lastServiceId);
    if (service?.category !== "foot") return false;
    const days = diffDays(today, s.lastVisit);
    return days > service.recallWeeks * 7 + 7 && days <= LATE_AFTER_WEEKS * 7;
  });
}

export function lowStock(state: DemoState) {
  return state.stock.filter((s) => s.inStock + s.onOrder <= s.reorderAt);
}

export function unreadCount(state: DemoState) {
  return state.inbox.filter((i) => !i.read).length;
}

/** Revenue for today: what is booked in total and what has been earned so far. */
export function todayRevenue(state: DemoState, today: DateKey, nowMinutes: number) {
  const list = dayBookings(state, today).filter((b) => b.status !== "noshow");
  return {
    expected: list.reduce((sum, b) => sum + b.price, 0),
    earned: list.filter((b) => b.start + b.duration <= nowMinutes).reduce((sum, b) => sum + b.price, 0),
  };
}

const earned = (b: Booking, today: DateKey) => b.status === "completed" || (b.status === "booked" && b.date < today);

export function revenueByMonth(state: DemoState, today: DateKey, months: number) {
  const keys: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1 - i, 1, 12);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  const totals = new Map(keys.map((k) => [k, 0]));
  for (const b of state.bookings) {
    const k = monthKey(b.date);
    if (totals.has(k) && earned(b, today)) totals.set(k, totals.get(k)! + b.price);
  }
  return keys.map((month) => ({ month, total: totals.get(month)! }));
}

export function revenueSplit(state: DemoState, today: DateKey, from: DateKey, by: "serviceId" | "staffId") {
  const totals = new Map<string, number>();
  for (const b of state.bookings) {
    if (b.date < from || b.date > today || !earned(b, today)) continue;
    totals.set(b[by], (totals.get(b[by]) ?? 0) + b.price);
  }
  return [...totals.entries()].map(([id, total]) => ({ id, total })).sort((a, b) => b.total - a.total);
}

/** Share of working minutes that are booked over a range of days. */
export function utilisation(state: DemoState, from: DateKey, days: number, staffId?: StaffId) {
  let capacity = 0;
  let booked = 0;
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i);
    const hours = openingFor(state.salon, date);
    if (!hours) continue;
    const lunch = lunchFor(state.salon, date);
    for (const staff of state.staff) {
      if ((staffId && staff.id !== staffId) || !staffWorks(staff, state.salon, date)) continue;
      capacity += hours.close - hours.open - (lunch ? lunch.end - lunch.start : 0);
      booked += dayBookings(state, date, staff.id).reduce((sum, b) => sum + b.duration, 0);
    }
  }
  return capacity ? booked / capacity : 0;
}

export function averageRating(state: DemoState) {
  if (!state.reviews.length) return 0;
  return state.reviews.reduce((sum, r) => sum + r.rating, 0) / state.reviews.length;
}
