import { addDays } from "./data/dates";
import { isActive, workMinutes } from "./data/slots";
import type { Booking, Customer, DateKey, DemoState, Service, StaffId } from "./data/types";
import { salesBetween } from "./stock/sales";

// Read-only views of the demo state used by several pages.

export function findCustomer(state: DemoState, id: string | undefined): Customer | undefined {
  return id ? state.customers.find((c) => c.id === id) : undefined;
}

export function findService(state: DemoState, id: string): Service | undefined {
  return state.services.find((s) => s.id === id);
}

export function fullName(c: Pick<Customer, "firstName" | "lastName">) {
  return `${c.firstName} ${c.lastName}`;
}

export function dayBookings(state: DemoState, date: DateKey, staffId?: StaffId, resourceId?: string): Booking[] {
  return state.bookings
    .filter((b) => b.date === date && isActive(b) && (!staffId || b.staffId === staffId) && (!resourceId || b.resourceId === resourceId))
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
  for (const sale of state.sales) {
    const s = stats.get(sale.customerId);
    if (s) s.spent += sale.amount;
  }
  return stats;
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
  const products = salesBetween(state, today, today);
  return {
    expected: list.reduce((sum, b) => sum + b.price, 0) + products,
    earned: list.filter((b) => b.start + b.duration <= nowMinutes).reduce((sum, b) => sum + b.price, 0) + products,
  };
}

const earned = (b: Booking, today: DateKey) => b.status === "completed" || (b.status === "booked" && b.date < today);

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
    for (const staff of state.staff) {
      const minutes = workMinutes(state, staff.id, date);
      if ((staffId && staff.id !== staffId) || !minutes) continue;
      capacity += minutes;
      booked += Math.min(minutes, dayBookings(state, date, staff.id).reduce((sum, b) => sum + b.duration, 0));
    }
  }
  return capacity ? booked / capacity : 0;
}

export function averageRating(state: DemoState) {
  if (!state.reviews.length) return 0;
  return state.reviews.reduce((sum, r) => sum + r.rating, 0) / state.reviews.length;
}

/** Id of the row that holds product sales in `revenueBetween`, next to the treatments. */
export const PRODUCTS_ROW = "products";

/** A visit that has happened: marked done, or booked and over by now. */
export function finishedVisit(b: Booking, today: DateKey, minutes: number) {
  return b.status === "completed" || (b.status === "booked" && (b.date < today || (b.date === today && b.start + b.duration <= minutes)));
}

/** Revenue earned in [start, end) as of now: finished visits only, split by treatment. */
export function revenueBetween(state: DemoState, today: DateKey, minutes: number, start: DateKey, end: DateKey) {
  const totals = new Map<string, number>();
  let visits = 0;
  for (const b of state.bookings) {
    if (b.date < start || b.date >= end) continue;
    if (!finishedVisit(b, today, minutes)) continue;
    visits += 1;
    totals.set(b.serviceId, (totals.get(b.serviceId) ?? 0) + b.price);
  }
  const products = state.sales.filter((sale) => sale.date >= start && sale.date < end && sale.date <= today);
  if (products.length) totals.set(PRODUCTS_ROW, products.reduce((sum, sale) => sum + sale.amount, 0));
  const byService = [...totals.entries()].map(([id, total]) => ({ id, total })).sort((a, b) => b.total - a.total);
  return { total: byService.reduce((sum, row) => sum + row.total, 0), visits, byService };
}
