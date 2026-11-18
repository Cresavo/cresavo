import { addDays } from "../data/dates";
import type { DateKey, DemoState, Service, StockItem, StockUse } from "../data/types";

/** Rounds to hundredths so repeated small deductions do not leave float noise. */
export const roundAmount = (value: number) => Math.round(value * 100) / 100;

const USAGE_WINDOW_DAYS = 28;

/** Everything one visit of this treatment uses up. */
export function usesOfService(state: DemoState, serviceId: string): StockUse[] {
  return [...state.services, ...state.retiredServices].find((s) => s.id === serviceId)?.consumption ?? [];
}

/** The treatments that use this product, with the amount per visit. */
export function usesOfProduct(state: DemoState, stockId: string): { service: Service; quantity: number }[] {
  return state.services.flatMap((service) => {
    const use = service.consumption?.find((u) => u.stockId === stockId);
    return use ? [{ service, quantity: use.quantity }] : [];
  });
}

/** The stock after the given amounts are used. Never below zero. */
export function deduct(stock: StockItem[], uses: StockUse[]): StockItem[] {
  return stock.map((item) => {
    const used = uses.filter((u) => u.stockId === item.id).reduce((sum, u) => sum + u.quantity, 0);
    return used ? { ...item, inStock: roundAmount(Math.max(0, item.inStock - used)) } : item;
  });
}

/**
 * How much of a product goes through the salon in a week: what finished
 * visits and sales used over the last four weeks. A product that nothing
 * is linked to falls back to the owner's own estimate.
 */
export function weeklyUsage(state: DemoState, item: StockItem, today: DateKey): number {
  const from = addDays(today, -USAGE_WINDOW_DAYS);
  let used = 0;
  for (const booking of state.bookings) {
    if (booking.status !== "completed" || booking.date <= from || booking.date > today) continue;
    used += usesOfService(state, booking.serviceId).filter((u) => u.stockId === item.id).reduce((sum, u) => sum + u.quantity, 0);
  }
  for (const sale of state.sales) {
    if (sale.stockId === item.id && sale.date > from && sale.date <= today) used += sale.quantity;
  }
  return used > 0 ? used / (USAGE_WINDOW_DAYS / 7) : item.usagePerWeek;
}
